const API_BASE = "http://localhost:3000/api";

// Tuning
const RADIUS_METERS = 3500;
const MAX_RESULTS = 20;
const LOCATION_CACHE_MS = 10 * 60 * 1000;

// Current cafe data for action buttons
let currentCafeData = null;
let currentWrapper = null;

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
}

function showEmptyState() {
  document.getElementById("emptyState").classList.remove("hidden");
  document.getElementById("cardStack").innerHTML = "";
  document.getElementById("savedList").classList.remove("visible");
  document.getElementById("actionBar").classList.remove("visible");
}

function hideEmptyState() {
  document.getElementById("emptyState").classList.add("hidden");
}

// Called by your button
function getLocation() {
  const cache = JSON.parse(localStorage.getItem("cachedLocation") || "{}");
  const now = Date.now();

  setStatus("Getting your location...");
  hideEmptyState();

  if (cache.timestamp && now - cache.timestamp < LOCATION_CACHE_MS) {
    setStatus("Fetching nearby cafes...");
    useLocation(cache.lat, cache.lng);
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolocation not supported in this browser.");
    setStatus("");
    showEmptyState();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      localStorage.setItem(
        "cachedLocation",
        JSON.stringify({ lat, lng, timestamp: now })
      );
      setStatus("Fetching nearby cafes...");
      useLocation(lat, lng);
    },
    () => {
      alert("Location access denied or unavailable.");
      setStatus("");
      showEmptyState();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function useLocation(lat, lng) {
  try {
    const res = await fetch(`${API_BASE}/nearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lat,
        lng,
        radius: RADIUS_METERS,
        maxResults: MAX_RESULTS,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Nearby search failed:", res.status, text);
      alert(`Places API error (${res.status}). Check console.`);
      setStatus("");
      showEmptyState();
      return;
    }

    const data = await res.json();
    const places = data.places || [];

    if (places.length === 0) {
      alert("No cafes found nearby.");
      setStatus("");
      showEmptyState();
      return;
    }

    setStatus("");
    displayCards(places, lat, lng);
  } catch (e) {
    console.error("Error fetching cafes:", e);
    alert("Error fetching cafes. Make sure the backend server is running.");
    setStatus("");
    showEmptyState();
  }
}

async function getPhotoUri(photoName) {
  try {
    const res = await fetch(
      `${API_BASE}/photo?name=${encodeURIComponent(photoName)}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data.photoUri || null;
  } catch {
    return null;
  }
}

function displayCards(places, userLat, userLng) {
  const container = document.getElementById("cardStack");
  const savedList = document.getElementById("savedList");
  const actionBar = document.getElementById("actionBar");

  container.innerHTML = "";
  savedList.classList.remove("visible");
  actionBar.classList.add("visible");
  hideEmptyState();

  places.forEach((place, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "swipe-wrapper";
    wrapper.style.zIndex = String(200 - i);

    const name = place.displayName?.text || "Unknown cafe";
    const rating = place.rating ?? "N/A";
    const mapsUri = place.googleMapsUri || "";
    const hours = place.currentOpeningHours || null;
    const isOpen = hours?.openNow;
    const todayHours = getTodayHours(hours);

    // Calculate distance
    const placeLat = place.location?.latitude;
    const placeLng = place.location?.longitude;
    let distanceText = "";
    if (placeLat && placeLng && userLat && userLng) {
      const miles = getDistanceMiles(userLat, userLng, placeLat, placeLng);
      distanceText = miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(1)} mi`;
    }

    // Analyze reviews for study score
    const studyData = analyzeStudyScore(place.reviews);
    const studyBadgeHtml = getStudyBadgeHtml(studyData);

    // Placeholder image
    const placeholder = "";

    const cafeData = {
      id: place.id,
      name,
      rating,
      distance: distanceText,
      mapsUri,
      photo: placeholder,
      hours: todayHours,
      studyScore: studyData.score,
      studyFeatures: studyData.features,
      isOpen,
    };

    wrapper.innerHTML = `
      <div class="cafe-card">
        <div class="card-image">
          <img src="${placeholder}" alt="${escapeHtml(name)}" />
          <div class="image-gradient"></div>
          <span class="swipe-badge save">SAVE</span>
          <span class="swipe-badge skip">NOPE</span>
        </div>
        <div class="card-content">
          <h2>${escapeHtml(name)}</h2>
          <div class="card-meta">
            <span class="rating">⭐ ${rating}</span>
            ${distanceText ? `<span class="distance">${distanceText}</span>` : ""}
            ${hours !== null ? `<span class="status ${isOpen ? "open" : "closed"}">${isOpen ? "Open" : "Closed"}</span>` : ""}
          </div>
          ${todayHours ? `<p class="card-hours">${escapeHtml(todayHours)}</p>` : ""}
          <div class="card-tags">
            ${studyBadgeHtml}
          </div>
          ${mapsUri ? `<a href="${mapsUri}" target="_blank" rel="noopener noreferrer" class="maps-link">View on Google Maps →</a>` : ""}
        </div>
      </div>
    `;

    // Store cafe data on the wrapper element
    wrapper.cafeData = cafeData;

    // Try to fetch a real image
    const firstPhoto = place.photos?.[0]?.name;
    if (firstPhoto) {
      getPhotoUri(firstPhoto).then((uri) => {
        if (!uri) return;
        const img = wrapper.querySelector(".card-image img");
        if (img) img.src = uri;
        cafeData.photo = uri;
      });
    }

    container.appendChild(wrapper);

    // Swipe handling with Hammer.js
    const hammertime = new Hammer(wrapper);
    hammertime.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL });
    hammertime.get("swipe").set({ direction: Hammer.DIRECTION_HORIZONTAL });

    // Pan for visual feedback
    hammertime.on("pan", (e) => {
      const rotation = e.deltaX * 0.05;
      wrapper.style.transform = `translateX(${e.deltaX}px) rotate(${rotation}deg)`;
      wrapper.style.transition = "none";

      // Show swipe badges based on direction
      if (e.deltaX > 50) {
        wrapper.classList.add("swiping-right");
        wrapper.classList.remove("swiping-left");
      } else if (e.deltaX < -50) {
        wrapper.classList.add("swiping-left");
        wrapper.classList.remove("swiping-right");
      } else {
        wrapper.classList.remove("swiping-right", "swiping-left");
      }
    });

    hammertime.on("panend", (e) => {
      wrapper.style.transition = "transform 0.3s ease, opacity 0.3s ease";
      wrapper.classList.remove("swiping-right", "swiping-left");

      if (Math.abs(e.deltaX) > 100) {
        // Swipe threshold met
        if (e.deltaX > 0) {
          saveCafe(cafeData);
          dismissCard(wrapper, 1);
        } else {
          dismissCard(wrapper, -1);
        }
      } else {
        // Snap back
        wrapper.style.transform = "";
      }
    });

    hammertime.on("swipeleft", () => dismissCard(wrapper, -1));
    hammertime.on("swiperight", () => {
      saveCafe(cafeData);
      dismissCard(wrapper, 1);
    });
  });

  // Set up first card for action buttons
  updateCurrentCard();
}

function updateCurrentCard() {
  const container = document.getElementById("cardStack");
  const cards = container.querySelectorAll(".swipe-wrapper");

  if (cards.length > 0) {
    currentWrapper = cards[0];
    currentCafeData = currentWrapper.cafeData;
  } else {
    currentWrapper = null;
    currentCafeData = null;
    // No more cards
    setStatus("No more cafes! Check your saved list ♥");
    document.getElementById("actionBar").classList.remove("visible");
  }
}

function dismissCard(wrapper, dir) {
  wrapper.style.transform = `translateX(${dir * 150}%) rotate(${dir * 30}deg)`;
  wrapper.style.opacity = "0";
  setTimeout(() => {
    wrapper.remove();
    updateCurrentCard();
  }, 300);
}

function saveCafe(cafeObj) {
  let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");

  if (!saved.find((c) => c.id === cafeObj.id)) {
    saved.push(cafeObj);
    localStorage.setItem("savedCafes", JSON.stringify(saved));
  }
}

// Action button handlers
document.addEventListener("DOMContentLoaded", () => {
  const nopeBtn = document.getElementById("nopeBtn");
  const saveBtn = document.getElementById("saveBtn");

  if (nopeBtn) {
    nopeBtn.addEventListener("click", () => {
      if (currentWrapper) {
        dismissCard(currentWrapper, -1);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (currentWrapper && currentCafeData) {
        saveCafe(currentCafeData);
        dismissCard(currentWrapper, 1);
      }
    });
  }
});

// Show saved cafes
function showSaved() {
  const cardStack = document.getElementById("cardStack");
  const savedList = document.getElementById("savedList");
  const actionBar = document.getElementById("actionBar");

  cardStack.innerHTML = "";
  actionBar.classList.remove("visible");
  hideEmptyState();
  savedList.classList.add("visible");

  const saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");

  setStatus("");

  if (saved.length === 0) {
    savedList.innerHTML = `
      <div class="saved-header">
        <h2>Saved Cafes</h2>
        <button class="back-btn" onclick="getLocation()">← Find More</button>
      </div>
      <div class="empty-saved">
        <div class="icon">💔</div>
        <p>No saved cafes yet.<br>Start swiping to save your favorites!</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="saved-header">
      <h2>Saved Cafes (${saved.length})</h2>
      <button class="back-btn" onclick="getLocation()">← Find More</button>
    </div>
  `;

  saved.forEach((cafe) => {
    const studyBadgeHtml = getStudyBadgeHtml({
      score: cafe.studyScore || 0,
      features: cafe.studyFeatures || [],
    });

    html += `
      <div class="saved-card">
        <img src="${cafe.photo || ""}" alt="${escapeHtml(cafe.name)}" class="saved-card-image" />
        <div class="saved-card-content">
          <h3>${escapeHtml(cafe.name)}</h3>
          <div class="saved-card-meta">
            <span>⭐ ${cafe.rating}</span>
            ${cafe.distance ? `<span>${cafe.distance}</span>` : ""}
          </div>
          ${studyBadgeHtml}
          <button class="remove-btn" data-remove="${cafe.id}">Remove</button>
        </div>
      </div>
    `;
  });

  savedList.innerHTML = html;

  // Remove button handlers
  savedList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-remove");
      removeSaved(id);
      showSaved();
    });
  });
}

function removeSaved(id) {
  let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");
  saved = saved.filter((c) => c.id !== id);
  localStorage.setItem("savedCafes", JSON.stringify(saved));
}

// Helper: escape HTML
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

// Get today's hours from periods array
function getTodayHours(hours) {
  if (!hours) return null;

  if (hours.weekdayDescriptions && Array.isArray(hours.weekdayDescriptions)) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    const todayEntry = hours.weekdayDescriptions.find((d) => d.startsWith(today));
    return todayEntry || null;
  }

  if (hours.periods && Array.isArray(hours.periods)) {
    const todayDay = new Date().getDay();
    const todayPeriod = hours.periods.find((p) => p.open?.day === todayDay);
    if (todayPeriod) {
      const openTime = formatTime(todayPeriod.open?.hour, todayPeriod.open?.minute);
      const closeTime = formatTime(todayPeriod.close?.hour, todayPeriod.close?.minute);
      return `${openTime} – ${closeTime}`;
    }
  }

  return null;
}

function formatTime(hour, minute) {
  if (hour === undefined) return "";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  const m = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h}${m} ${ampm}`;
}

// Calculate distance (Haversine formula)
function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Analyze reviews for study score
function analyzeStudyScore(reviews) {
  if (!reviews || reviews.length === 0) return { score: 0, features: [] };

  const allText = reviews.map((r) => r.text?.text || "").join(" ").toLowerCase();

  const categories = {
    wifi: /\b(wifi|wi-fi|internet|free wifi)\b/i,
    laptop: /\b(laptop|remote work|work from|working|computer)\b/i,
    outlets: /\b(outlet|plug|charging|power)\b/i,
    seating: /\b(seating|seats|tables|spacious|roomy|plenty of room)\b/i,
    quiet: /\b(quiet|peaceful|calm|study|studying|focus|concentrate)\b/i,
  };

  const features = [];
  for (const [name, regex] of Object.entries(categories)) {
    if (regex.test(allText)) features.push(name);
  }

  return { score: features.length, features };
}

// Get study badge HTML with tooltip
function getStudyBadgeHtml(studyData) {
  const { score, features } = studyData;
  const hasWifi = features.includes("wifi");
  const otherFeatures = features.filter((f) => f !== "wifi").length;

  // Feature display names
  const featureLabels = {
    wifi: "WiFi",
    laptop: "Laptop-friendly",
    outlets: "Outlets",
    seating: "Good seating",
    quiet: "Quiet atmosphere",
  };

  // Build detected features text
  const detectedFeatures = features.map((f) => featureLabels[f] || f);
  const featuresText =
    detectedFeatures.length > 0
      ? detectedFeatures.join(", ")
      : "No features detected";

  let badgeClass, badgeText, reasonText;

  if (hasWifi && otherFeatures >= 1) {
    badgeClass = "great";
    badgeText = "Great study spot";
    reasonText = "WiFi + other features";
  } else if (hasWifi) {
    badgeClass = "good";
    badgeText = "Good study spot";
    reasonText = "WiFi mentioned in reviews";
  } else if (score >= 2) {
    badgeClass = "good";
    badgeText = "Good study spot";
    reasonText = "Multiple study features";
  } else if (score === 1) {
    badgeClass = "inconclusive";
    badgeText = "Inconclusive";
    reasonText = "Limited info in reviews";
  } else {
    badgeClass = "inconclusive";
    badgeText = "Inconclusive";
    reasonText = "No study info in reviews";
  }

  return `
    <span class="study-badge-wrapper">
      <span class="study-badge ${badgeClass}">📚 ${badgeText}</span>
      <span class="study-tooltip">
        <div class="tooltip-title">${reasonText}</div>
        <div class="tooltip-features">Found: ${featuresText}</div>
      </span>
    </span>
  `;
}

// Expose for inline onclick handlers
window.getLocation = getLocation;
window.showSaved = showSaved;
