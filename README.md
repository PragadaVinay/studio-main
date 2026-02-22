# RouteVista India (Rome2Rio-Inspired Travel Planner)

A professional travel planning web app built with **Node.js + Express + HTML/CSS/JavaScript** to compare route options across India in **Indian Rupees (₹)**.

## Features

- Route search between two Indian locations.
- Transport comparison by mode:
  - Flight (Budget / Standard / Premium)
  - Train (Budget / Standard / Premium)
  - Bus (Budget / Standard / Premium)
- Dynamic 2026+ pricing recommendations via **SambaNova AI** with fallback pricing.
- Firebase Authentication support (Google sign-in via popup; extendable to email/password).
- Firestore support for:
  - user profiles/preferences
  - saved routes
  - user reviews and ratings
- Firebase Storage support for review image uploads.
- Leaflet + OpenStreetMap route map visualization.
- Tabbed UX: AI Recommendations, Comparison, Hotels, Restaurants, and Reviews panels.
- Route suggestions (viewpoints/nearby stops) with “+” note action.
- Responsive UI inspired by Rome2Rio-style clarity.
- Accessibility touches: labels, status region (`aria-live`), semantic sections.

## Tech Stack

- Frontend: HTML, CSS, JavaScript (no TypeScript, no Tailwind)
- Backend: Node.js + Express
- AI: SambaNova Chat Completions API
- Auth/DB/Storage: Firebase Authentication, Firestore, Firebase Storage
- Maps: Leaflet + OpenStreetMap

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root:

```env
PORT=3000
SAMBANOVA_API_KEY=your_sambanova_api_key
SAMBANOVA_MODEL=Meta-Llama-3.1-8B-Instruct
```

3. (Optional but recommended) Configure Firebase:

- Copy `public/firebase-config.example.js` to `public/firebase-config.js`.
- Fill with your Firebase web config values.
- Add this script tag before `app.js` in `public/index.html`:

```html
<script src="firebase-config.js"></script>
```

4. Run the app:

```bash
npm start
```

5. Open:

- `http://localhost:3000`

## Firebase Notes

Enable these in your Firebase project:

- Authentication: Google provider (and/or Email/Password)
- Firestore database (rules for authenticated writes)
- Firebase Storage (rules for review photo uploads)

## SambaNova Notes

- Endpoint used: `POST https://api.sambanova.ai/v1/chat/completions`
- The backend requests strict JSON and safely parses AI output.
- If parsing fails or API is unavailable, fallback India pricing data is used.

## Performance & Reliability

- Static assets served by Express.
- Lightweight dependency set.
- Frontend gracefully degrades to localStorage if Firebase isn’t configured.

## Project Structure

```
.
├── public/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   └── firebase-config.example.js
├── .env (you create)
├── package.json
├── server.js
└── README.md
```

## Future Enhancements

- Real geocoding/routing API integration for exact road/rail geometry.
- Provider-specific deep links and live timetable integrations.
- Advanced filters (duration, transfers, seat class, amenities).
- Email/password sign-up UI and profile editor.
