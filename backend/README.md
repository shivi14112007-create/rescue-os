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
| POST | `/batches/preview` | Live preview of the recommendation — does NOT save to DB |
| POST | `/batches` | Seller logs a batch → auto shelf-life estimate + agent recommendation |
| GET | `/batches` | List all batches (optional `?status=risk`) |
| GET | `/batches/{id}` | Single batch detail |
| POST | `/batches/{id}/claim` | Buyer/NGO claims a batch |
| GET | `/impact` | Aggregate metrics: kg listed/rescued, revenue recovered, batches saved |

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

## Produce vision (`app/vision.py`)

3-step fallback for identifying produce type + grading visible quality from
one photo:
1. **Gemini 2.0 Flash** (multimodal LLM) - primary
2. **Groq llama-3.2-11b-vision** - backup LLM
3. **Offline fallback** (no API/network needed):
   - **Quality grading**: classical CV heuristic (dark/brown pixel ratio + dullness).
   - **Produce type**: a **trained RandomForestClassifier** (`app/models/produce_type_classifier.joblib`),
     trained on a Fruits-360 subset (apple, banana, mango, papaya, cauliflower, onion,
     potato, tomato, grapes - 5,754 training images) using HSV color-histogram + HOG
     features. 99% accuracy on the Fruits-360 test split, though that's studio-lit
     product photos on a plain background - real mandi photos will be harder, which is
     why confidence is still capped (`TYPE_CONFIDENCE_CAP`) and low-confidence guesses
     don't auto-fill the form. Falls back further to the old hand-tuned color/shape
     heuristic if the model file is ever missing. Retrain with `python train_produce_classifier.py`
     (needs the Fruits-360 dataset checked out locally first - see the script's docstring).
   - Spinach has no trained-model support (no images for it in Fruits-360) - still
     heuristic-only.

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