"""
Rescue OS - main FastAPI app.

Endpoints:
  POST /batches            - seller logs a new batch (auto-estimates shelf life + gets agent recommendation)
  GET  /batches             - list all batches (dashboard feed)
  GET  /batches/{id}        - single batch detail
  POST /batches/{id}/claim  - buyer/NGO claims a discounted/donated batch
  GET  /impact              - aggregate impact metrics (kg saved, batches rescued)

Run locally:
  pip install -r requirements.txt
  export GROQ_API_KEY=gsk-...          (optional - falls back through Gemini, backup Groq, then rules)
  export GEMINI_API_KEY=...            (optional - second provider in the fallback chain)
  uvicorn app.main:app --reload
Then open http://127.0.0.1:8000/docs for interactive API docs.
"""
from datetime import date, datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, get_conn, row_to_dict
from app.models import BatchCreate, ClaimRequest, BatchResponse
from app.shelf_life import estimate_remaining_shelf_life, classify_status
from app.agent import get_agent_recommendation

app = FastAPI(title="Rescue OS", description="Dynamic Rescue Marketplace for Fresh Produce")

# Allow the React frontend (running on a different port during dev) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend URL before real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/batches", response_model=BatchResponse)
def create_batch(batch: BatchCreate):
    """Seller logs a new batch. We immediately compute shelf life + agent recommendation."""
    remaining_days = estimate_remaining_shelf_life(
        produce_type=batch.produce_type,
        harvest_date=batch.harvest_date,
        storage_condition=batch.storage_condition,
    )
    status = classify_status(remaining_days)

    recommendation = get_agent_recommendation(
        produce_type=batch.produce_type,
        remaining_days=remaining_days,
        quantity_kg=batch.quantity_kg,
        location=batch.location,
    )

    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO batches (
                produce_type, quantity_kg, harvest_date, storage_condition,
                location, seller_name, remaining_shelf_life_days, status,
                recommended_action, discount_pct, agent_reasoning, agent_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                batch.produce_type, batch.quantity_kg, batch.harvest_date.isoformat(),
                batch.storage_condition, batch.location, batch.seller_name,
                remaining_days, status,
                recommendation["action"], recommendation.get("discount_pct", 0),
                recommendation["reasoning"], recommendation.get("source", "unknown"),
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM batches WHERE id = ?", (new_id,)).fetchone()

    return row_to_dict(row)


@app.get("/batches", response_model=list[BatchResponse])
def list_batches(status: str | None = None):
    """List all batches, optionally filtered by status (fresh/risk/urgent/expired/claimed)."""
    with get_conn() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC", (status,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM batches ORDER BY created_at DESC").fetchall()

    return [row_to_dict(r) for r in rows]


@app.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Batch not found")
    return row_to_dict(row)


@app.post("/batches/{batch_id}/claim", response_model=BatchResponse)
def claim_batch(batch_id: int, claim: ClaimRequest):
    """Buyer or NGO claims a batch that was marked for markdown/donation/fast-track."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Batch not found")
        if row["status"] == "claimed":
            raise HTTPException(status_code=409, detail="Batch already claimed")

        conn.execute(
            "UPDATE batches SET status = 'claimed', claimed_by = ?, claimed_at = ? WHERE id = ?",
            (claim.claimed_by, datetime.now().isoformat(), batch_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()

    return row_to_dict(updated)


@app.get("/impact")
def get_impact_metrics():
    """Aggregate metrics for the dashboard 'impact' counter - the strongest demo visual."""
    with get_conn() as conn:
        total_batches = conn.execute("SELECT COUNT(*) as c FROM batches").fetchone()["c"]
        claimed = conn.execute("SELECT COUNT(*) as c FROM batches WHERE status = 'claimed'").fetchone()["c"]
        expired = conn.execute("SELECT COUNT(*) as c FROM batches WHERE status = 'expired'").fetchone()["c"]
        kg_rescued = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches WHERE status = 'claimed'"
        ).fetchone()["total"]
        kg_at_risk = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches WHERE status IN ('risk', 'urgent')"
        ).fetchone()["total"]

    return {
        "total_batches_logged": total_batches,
        "batches_rescued": claimed,
        "batches_expired": expired,
        "kg_rescued": kg_rescued,
        "kg_currently_at_risk": kg_at_risk,
    }


@app.get("/")
def root():
    return {"message": "Rescue OS API is running. See /docs for the interactive API explorer."}