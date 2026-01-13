require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in .env file");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Proxy: Nearby Search
app.post("/api/nearby", async (req, res) => {
  const { lat, lng, radius = 1500, maxResults = 20 } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const endpoint = "https://places.googleapis.com/v1/places:searchNearby";

  const body = {
    includedTypes: ["cafe"],
    maxResultCount: maxResults,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius,
      },
    },
  };

  const fieldMask =
    "places.displayName,places.id,places.rating,places.formattedAddress,places.googleMapsUri,places.photos,places.currentOpeningHours,places.location,places.reviews";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Google API error:", response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Nearby search error:", error);
    res.status(500).json({ error: "Failed to fetch nearby places" });
  }
});

// Proxy: Photo
app.get("/api/photo", async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "name query parameter is required" });
  }

  const endpoint = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=600&skipHttpRedirect=true`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Photo API error:", response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Photo fetch error:", error);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
