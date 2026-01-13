export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.error("Missing GOOGLE_PLACES_API_KEY environment variable");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { lat, lng, radius = 1500, maxResults = 20 } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const endpoint = "https://places.googleapis.com/v1/places:searchNearby";

  const body = {
    includedTypes: ["cafe"],
    excludedTypes: ["museum", "art_gallery", "tourist_attraction"],
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
}
