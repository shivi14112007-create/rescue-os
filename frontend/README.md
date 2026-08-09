# Rescue OS — Frontend

React + Vite + Tailwind. Light dashboard UI (sidebar nav, stat cards, live AI preview,
marketplace grid) modeled on the approved reference design.

## Setup

```bash
npm install
npm run dev
```

Opens at `http://127.0.0.1:5173`. Start the backend first at `http://127.0.0.1:8000`
(see `rescue-os-backend/README.md`) — CORS is already open for local dev.

## Pages

- **Dashboard** — stat cards, batch status breakdown, recent batches table, impact donut chart
- **Add Batch** — form with a **live AI recommendation preview** (debounced call to
  `POST /batches/preview`, which doesn't save anything — updates as you type)
- **My Batches** — full table of everything you've logged
- **Marketplace** — claimable batches (markdown / fast-track / donate), with search + filters
- **Batch Detail** — slide-over panel with full batch info, opened from any table/card's "View"

## Structure

```
src/
├── App.jsx                      — layout, page routing, data fetching
├── api.js                       — fetch helpers (create, preview, list, claim, impact)
├── index.css                    — Tailwind + Inter font + shared .input style
└── components/
    ├── Sidebar.jsx               — left nav
    ├── StatCards.jsx             — top 4 metric cards
    ├── StatusOverview.jsx        — Hold/Markdown/Fast-Track/Donate breakdown
    ├── RecentBatchesTable.jsx    — dashboard's recent-batches list
    ├── ImpactSnapshot.jsx        — donut chart (recharts) + "meals not wasted"
    ├── AddBatchForm.jsx          — batch entry + live preview panel
    ├── MyBatches.jsx             — full batches table
    ├── Marketplace.jsx           — claimable batches grid
    ├── BatchDetail.jsx           — slide-over detail panel
    ├── ActionBadge.jsx           — shared Hold/Markdown/Fast-Track/Donate pill
    └── produceEmoji.js           — emoji lookup (stand-in for product photos)
```

## Notes

- Produce "photos" are emoji tiles, not real images — swap `produceEmoji.js` for real
  photography/uploads later without touching any other component.
- The demo user is hardcoded as "Ramesh Yadav" in `App.jsx` (`SELLER_NAME`) — wire up real
  auth later if needed.
- Revenue Recovered on the dashboard reflects the backend's `price_per_kg` × discount logic;
  batches without a price simply don't contribute to that figure.
