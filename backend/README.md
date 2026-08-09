# Rescue OS — Backend

Dynamic Rescue Marketplace for fresh produce. FastAPI + SQLite + Claude (with rule-based fallback).

## Setup

```bash
pip install -r requirements.txt

# Both optional — the agent falls through this chain automatically:
#   Groq (primary model) -> Gemini -> Groq (backup model) -> rule-based logic
# Demo works fully even with zero keys set (pure rule-based).
export GROQ_API_KEY=gsk_...      # free at https://console.groq.com
export GEMINI_API_KEY=...        # free at https://aistudio.google.com/apikey

uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs for interactive API testing (Swagger UI).

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/batches` | Seller logs a batch → auto shelf-life estimate + agent recommendation |
| GET | `/batches` | List all batches (optional `?status=risk`) |
| GET | `/batches/{id}` | Single batch detail |
| POST | `/batches/{id}/claim` | Buyer/NGO claims a batch |
| GET | `/impact` | Aggregate metrics: kg rescued, batches saved |

## Example: create a batch

```bash
curl -X POST http://127.0.0.1:8000/batches \
  -H "Content-Type: application/json" \
  -d '{
    "produce_type": "tomato",
    "quantity_kg": 45,
    "harvest_date": "2026-08-06",
    "storage_condition": "room_temp",
    "location": "Azadpur Mandi, Delhi",
    "seller_name": "Ramesh Traders"
  }'
```

## Design notes

- **Shelf-life engine** (`app/shelf_life.py`): base days per produce type × storage-condition
  multiplier − days since harvest. Not a flat lookup table — this is the "innovation" angle
  for judging.
- **Agent** (`app/agent.py`): tries a chain of free providers in order —
  Groq `llama-3.3-70b-versatile` → Gemini `gemini-2.0-flash` → Groq `llama-3.1-8b-instant`
  (different quota than the first) → deterministic rule-based logic. Each step only runs if
  the previous one fails (missing key, rate limit, bad JSON, network issue). The response
  includes an `agent_source` field so you can see which provider actually answered —
  **the demo never breaks on stage**, even if every API is down.
- **Storage**: SQLite, single file (`rescue_os.db`), zero setup. Swap for Postgres later if
  you need multi-instance deployment.

## Next steps (frontend)

This backend is ready for the React (Vite + Tailwind) dashboard — seller view (batch entry +
list) and buyer/NGO view (browse + claim). CORS is already open for local dev.