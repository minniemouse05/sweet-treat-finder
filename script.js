const API_BASE = "http://localhost:3000/api";

// Tuning
const RADIUS_METERS = 1500;
const MAX_RESULTS = 20;
const LOCATION_CACHE_MS = 10 * 60 * 1000;

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
}

// Called by your button
function getLocation() {
  const cache = JSON.parse(localStorage.getItem("cachedLocation") || "{}");
  const now = Date.now();

  setStatus("📍 Getting your location…");

  if (cache.timestamp && now - cache.timestamp < LOCATION_CACHE_MS) {
    setStatus("📍 Using cached location (last 10 min). Fetching cafes…");
    useLocation(cache.lat, cache.lng);
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolocation not supported in this browser.");
    setStatus("");
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
      setStatus("📍 Location found. Fetching cafes…");
      useLocation(lat, lng);
    },
    () => {
      alert("Location access denied or unavailable.");
      setStatus("");
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
      return;
    }

    const data = await res.json();
    const places = data.places || [];

    if (places.length === 0) {
      alert("No cafes found nearby.");
      setStatus("");
      return;
    }

    setStatus("☕️ Swipe left to skip, swipe right to save 💖");
    displayCards(places, lat, lng);
  } catch (e) {
    console.error("Error fetching cafes:", e);
    alert("Error fetching cafes. Make sure the backend server is running.");
    setStatus("");
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
  const container = document.querySelector(".cards");
  container.classList.remove("list-mode");
  container.innerHTML = "";

  places.forEach((place, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "swipe-wrapper";
    wrapper.style.zIndex = String(200 - i);

    const card = document.createElement("div");
    card.className = "location-card";

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
      distanceText = miles < 0.1 ? "< 0.1 mi away" : `${miles.toFixed(1)} mi away`;
    }

    // Analyze reviews for study score
    const studyData = analyzeStudyScore(place.reviews);
    const studyBadge = getStudyBadge(studyData);

    // start with a placeholder; we'll replace if we can fetch a photoUri
    const placeholder = "https://via.placeholder.com/250x150?text=No+Image";

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
    };

    card.innerHTML = `
      <img src="${placeholder}" alt="${escapeHtml(name)}" />
      <h3>${escapeHtml(name)}</h3>
      <p>⭐️ Rating: ${rating}</p>
      ${hours ? `<p class="${isOpen ? "open-now" : "closed-now"}">${isOpen ? "Open now" : "Closed"}</p>` : ""}
      ${todayHours ? `<p><small>🕐 ${escapeHtml(todayHours)}</small></p>` : ""}
      ${distanceText ? `<p><small>📍 ${distanceText}</small></p>` : ""}
      ${studyBadge}
      ${
        mapsUri
          ? `<p><a href="${mapsUri}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>`
          : ""
      }
      <p><small>Swipe right to save 💖</small></p>
    `;

    // Try to fetch a real image (optional; costs extra calls)
    const firstPhoto = place.photos?.[0]?.name;
    if (firstPhoto) {
      getPhotoUri(firstPhoto).then((uri) => {
        if (!uri) return;
        const img = card.querySelector("img");
        if (img) img.src = uri;
        cafeData.photo = uri;
      });
    }

    wrapper.appendChild(card);
    container.appendChild(wrapper);

    // Swipe handling
    const hammertime = new Hammer(wrapper);
    hammertime.get("swipe").set({ direction: Hammer.DIRECTION_HORIZONTAL });

    hammertime.on("swipeleft", () => dismissCard(wrapper, -1));
    hammertime.on("swiperight", () => {
      saveCafe(cafeData);
      dismissCard(wrapper, +1);
    });
  });
}

function dismissCard(wrapper, dir) {
  wrapper.style.transform = `translateX(${dir * 150}%) rotate(${dir * 15}deg)`;
  wrapper.style.opacity = "0";
  setTimeout(() => wrapper.remove(), 120);
}

function saveCafe(cafeObj) {
  let saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");

  if (!saved.find((c) => c.id === cafeObj.id)) {
    saved.push(cafeObj);
    localStorage.setItem("savedCafes", JSON.stringify(saved));
    alert(`${cafeObj.name} saved!`);
  } else {
    alert(`${cafeObj.name} is already saved.`);
  }
}

// Called by your button
function showSaved() {
  const container = document.querySelector(".cards");
  container.classList.add("list-mode");
  container.innerHTML = "";

  const saved = JSON.parse(localStorage.getItem("savedCafes") || "[]");

  setStatus("💾 Saved cafes");

  if (saved.length === 0) {
    container.innerHTML = "<p>No saved cafes yet 😢</p>";
    return;
  }

  saved.forEach((cafe) => {
    const card = document.createElement("div");
    card.className = "location-card";

    const studyBadge = getStudyBadge({ score: cafe.studyScore || 0, features: cafe.studyFeatures || [] });

    card.innerHTML = `
      <img src="${cafe.photo}" alt="${escapeHtml(cafe.name)}" />
      <h3>${escapeHtml(cafe.name)}</h3>
      <p>⭐️ Rating: ${cafe.rating}</p>
      ${cafe.hours ? `<p><small>🕐 ${escapeHtml(cafe.hours)}</small></p>` : ""}
      ${cafe.distance ? `<p><small>📍 ${escapeHtml(cafe.distance)}</small></p>` : ""}
      ${studyBadge}
      ${
        cafe.mapsUri
          ? `<p><a href="${cafe.mapsUri}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>`
          : ""
      }
      <button class="small-btn" data-remove="${cafe.id}">Remove</button>
    `;

    container.appendChild(card);
  });

  // Remove buttons
  container.querySelectorAll("[data-remove]").forEach((btn) => {
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

// tiny helper to keep innerHTML safe
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
        m
      ])
  );
}

// Get today's hours from periods array
function getTodayHours(hours) {
  if (!hours) return null;

  // If weekdayDescriptions exists, use it
  if (hours.weekdayDescriptions && Array.isArray(hours.weekdayDescriptions)) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    const todayEntry = hours.weekdayDescriptions.find((d) => d.startsWith(today));
    return todayEntry || null;
  }

  // Otherwise, format from periods
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

// Format hour/minute to readable time
function formatTime(hour, minute) {
  if (hour === undefined) return "";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  const m = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h}${m} ${ampm}`;
}

// Calculate distance between two coordinates in miles (Haversine formula)
function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Analyze reviews to determine if cafe is good for studying
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

// Get study badge HTML - WiFi weighted more heavily
function getStudyBadge(studyData) {
  const { score, features } = studyData;
  const hasWifi = features.includes("wifi");
  const otherFeatures = features.filter(f => f !== "wifi").length;

  if (hasWifi && otherFeatures >= 1) {
    // WiFi + at least 1 other feature = Great
    return `<p class="study-badge great">📚 Great study spot</p>`;
  } else if (hasWifi) {
    // WiFi only = Good
    return `<p class="study-badge good">📚 Good study spot</p>`;
  } else if (score >= 2) {
    // 2+ features without WiFi = Good
    return `<p class="study-badge good">📚 Good study spot</p>`;
  } else if (score === 1) {
    // 1 feature without WiFi = Inconclusive
    return `<p class="study-badge inconclusive">📚 Inconclusive study spot</p>`;
  } else {
    // No features = Inconclusive
    return `<p class="study-badge inconclusive">📚 Inconclusive study spot</p>`;
  }
}

// Expose for inline onclick handlers
window.getLocation = getLocation;
window.showSaved = showSaved;
