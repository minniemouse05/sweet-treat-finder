# Caf(e)inder ☕

A Tinder-style cafe discovery app that helps you find the perfect spot to work, study, or enjoy coffee. Swipe right to save, left to skip.

Live: https://cafeinder.vercel.app/

## Features

- **Swipe Interface** - Dating app-style card swiping to browse cafes
- **Location-Based** - Finds cafes within 3.5km of your current location
- **Study Spot Analysis** - Analyzes reviews to determine if a cafe is good for studying (WiFi, outlets, seating, quiet atmosphere)
- **Save Favorites** - Save cafes you like and view them later
- **Real-Time Info** - Shows ratings, distance, open/closed status, and hours

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Gesture Library**: [Hammer.js](https://hammerjs.github.io/) for swipe detection
- **API**: Google Places API (New)
- **Hosting**: Vercel (serverless functions)

## Project Structure

```ini
cafe-curator/
├── api/                  # Vercel serverless functions
│   ├── nearby.js         # Fetches nearby cafes
│   └── photo.js          # Fetches cafe photos
├── index.html            # Main HTML
├── styles.css            # Dating app-inspired styling
├── script.js             # App logic & swipe handling
├── vercel.json           # Vercel config
└── package.json
```

## Setup

### Prerequisites

- Node.js 18+
- Google Cloud account with Places API (New) enabled

### Local Development

1. Clone the repo:

```bash
git clone https://github.com/minniemouse05/sweet-treat-finder.git
cd sweet-treat-finder
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root:

```ini
GOOGLE_PLACES_API_KEY=your_api_key_here
```

4. Run locally with Vercel:

```bash
npm run dev
```

5. Open http://localhost:3000

### Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com)
3. Add environment variable:

   - `GOOGLE_PLACES_API_KEY` = your API key

4. Deploy!

## How It Works

### Swipe Gestures

The app uses Hammer.js to detect touch/mouse gestures:

- **Swipe Right** → Save cafe to favorites
- **Swipe Left** → Skip cafe
- **Tap Buttons** → Use ✕ (skip) or ♥ (save) buttons

### Study Spot Scoring

Reviews are analyzed for keywords in 5 categories:

| Category | Keywords |
|----------|----------|
| WiFi | wifi, wi-fi, internet |
| Laptop | laptop, remote work, working |
| Outlets | outlet, plug, charging, power |
| Seating | seating, tables, spacious |
| Quiet | quiet, peaceful, study, focus |

**Rating Logic:**

- **Great** = WiFi + 1 other feature
- **Good** = WiFi only, or 2+ features without WiFi
- **Inconclusive** = 0-1 features, no WiFi

## API Endpoints

### POST `/api/nearby`

Fetches nearby cafes.

**Request:**

```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "radius": 3500,
  "maxResults": 20
}
```

### GET `/api/photo?name={photoName}`

Fetches a photo URL for a cafe.
