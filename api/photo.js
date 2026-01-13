export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.error("Missing GOOGLE_PLACES_API_KEY environment variable");
    return res.status(500).json({ error: "Server configuration error" });
  }

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
}
