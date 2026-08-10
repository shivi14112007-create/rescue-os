"""
Rescue OS - main FastAPI app.

Endpoints:
  POST /batches            - seller logs a new batch (auto-estimates shelf life + gets agent recommendation)
  GET  /batches             - list all batches (dashboard feed)
  GET  /batches/{id}        - single batch detail
  POST /batches/{id}/claim  - buyer/NGO claims a discounted/donated batch
  POST /batches/{id}/complete - seller confirms a claimed batch was actually picked up
  GET  /impact              - aggregate impact metrics (kg saved, batches rescued, revenue recovered)

Run locally:
  pip install -r requirements.txt
  export GROQ_API_KEY=gsk-...          (optional - falls back through Gemini, backup Groq, then rules)
  export GEMINI_API_KEY=...            (optional - second provider in the fallback chain)
  uvicorn app.main:app --reload
Then open http://127.0.0.1:8000/docs for interactive API docs.
"""
from dotenv import load_dotenv
load_dotenv()  # must run before app.agent is imported, since it reads keys at import time

from datetime import date, datetime
from math import radians, sin, cos, sqrt, atan2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, get_conn, row_to_dict
from app.models import (
    BatchCreate, ClaimRequest, BatchResponse, BatchPreviewRequest,
    BatchPreviewResponse, ImpactResponse,
)
from app.shelf_life import estimate_remaining_shelf_life, classify_status
from app.agent import get_agent_recommendation
from app.partners_live import find_live_partners

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


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in kilometers."""
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


@app.post("/batches/preview", response_model=BatchPreviewResponse)
def preview_batch(batch: BatchPreviewRequest):
    """
    Live preview of the AI recommendation as the seller fills the form -
    does NOT save anything to the database. Used for the 'AI Recommendation
    Preview' panel that updates before the seller hits Submit.
    """
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
        storage_condition=batch.storage_condition,
        language=batch.language,
    )

    discounted_price = None
    if batch.price_per_kg and recommendation["action"] == "markdown":
        discounted_price = round(batch.price_per_kg * (1 - recommendation.get("discount_pct", 0) / 100), 2)

    return {
        "remaining_shelf_life_days": remaining_days,
        "status": status,
        "recommended_action": recommendation["action"],
        "discount_pct": recommendation.get("discount_pct", 0),
        "agent_reasoning": recommendation["reasoning"],
        "agent_source": recommendation.get("source", "unknown"),
        "discounted_price_per_kg": discounted_price,
    }


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
        storage_condition=batch.storage_condition,
        language=batch.language,
    )

    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO batches (
                produce_type, quantity_kg, harvest_date, storage_condition,
                location, latitude, longitude, seller_name, price_per_kg, notes,
                remaining_shelf_life_days, status,
                recommended_action, discount_pct, agent_reasoning, agent_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                batch.produce_type, batch.quantity_kg, batch.harvest_date.isoformat(),
                batch.storage_condition, batch.location, batch.latitude, batch.longitude,
                batch.seller_name, batch.price_per_kg, batch.notes,
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
def list_batches(
    status: str | None = None,
    near_lat: float | None = None,
    near_lng: float | None = None,
):
    """
    List all batches, optionally filtered by status (fresh/risk/urgent/expired/claimed).

    Pass near_lat/near_lng (e.g. the buyer's current GPS position) to sort results by
    distance from that point instead of recency - nearest batch first. Batches that
    don't have coordinates logged sort to the end since distance can't be computed.
    """
    with get_conn() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC", (status,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM batches ORDER BY created_at DESC").fetchall()

    batches = [row_to_dict(r) for r in rows]

    if near_lat is not None and near_lng is not None:
        def distance_km(b):
            if b["latitude"] is None or b["longitude"] is None:
                return float("inf")
            return haversine_km(near_lat, near_lng, b["latitude"], b["longitude"])

        batches.sort(key=distance_km)

    return batches


@app.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Batch not found")
    return row_to_dict(row)


@app.post("/automation/refresh")
def refresh_batch_risk():
    """
    Recalculate shelf life and status for active batches.

    This endpoint is intended to be called automatically by n8n.
    It keeps the Rescue OS risk state dynamic instead of relying only
    on the values calculated when a batch was originally created.
    """
    updated_batches = []

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM batches
            WHERE status NOT IN ('claimed', 'completed')
            ORDER BY created_at DESC
            """
        ).fetchall()

        for row in rows:
            remaining_days = estimate_remaining_shelf_life(
                produce_type=row["produce_type"],
                harvest_date=date.fromisoformat(row["harvest_date"]),
                storage_condition=row["storage_condition"],
            )

            new_status = classify_status(remaining_days)

            conn.execute(
                """
                UPDATE batches
                SET remaining_shelf_life_days = ?,
                    status = ?
                WHERE id = ?
                """,
                (
                    remaining_days,
                    new_status,
                    row["id"],
                ),
            )

            updated_batches.append({
                "id": row["id"],
                "produce_type": row["produce_type"],
                "quantity_kg": row["quantity_kg"],
                "location": row["location"],
                "remaining_shelf_life_days": remaining_days,
                "old_status": row["status"],
                "new_status": new_status,
                "recommended_action": row["recommended_action"],
            })

        conn.commit()

    return {
        "success": True,
        "count": len(updated_batches),
        "updated_batches": updated_batches,
    }


@app.get("/automation/critical")
def get_critical_batches():
    """
    Return batches that currently need rescue attention.

    Used by n8n to identify batches that should enter the
    Rescue Autopilot workflow.
    """
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM batches
            WHERE status IN ('risk', 'urgent', 'expired')
            ORDER BY
                CASE status
                    WHEN 'expired' THEN 1
                    WHEN 'urgent' THEN 2
                    WHEN 'risk' THEN 3
                    ELSE 4
                END,
                remaining_shelf_life_days ASC
            """
        ).fetchall()

    return [row_to_dict(row) for row in rows]


@app.post("/automation/{batch_id}/escalate")
def escalate_batch(batch_id: int):
    """
    Move an unrescued batch to the next rescue strategy.

    Rescue progression:
        hold -> markdown -> fast_track -> donate
    """
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM batches WHERE id = ?",
            (batch_id,),
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Batch not found",
            )

        if row["status"] in ("claimed", "completed"):
            return {
                "success": False,
                "message": "Batch has already been rescued.",
                "batch": row_to_dict(row),
            }

        current_action = row["recommended_action"]

        escalation_map = {
            None: "markdown",
            "hold": "markdown",
            "markdown": "fast_track",
            "fast_track": "donate",
            "donate": "compost",
            "compost": "compost",
        }

        next_action = escalation_map.get(
            current_action,
            "donate",
        )

        conn.execute(
            """
            UPDATE batches
            SET recommended_action = ?
            WHERE id = ?
            """,
            (
                next_action,
                batch_id,
            ),
        )

        conn.commit()

        updated = conn.execute(
            "SELECT * FROM batches WHERE id = ?",
            (batch_id,),
        ).fetchone()

    return {
        "success": True,
        "previous_action": current_action,
        "new_action": next_action,
        "batch": row_to_dict(updated),
    }


@app.get("/automation/{batch_id}/match")
def match_batch(batch_id: int, limit: int = 3):
    """
    Rescue Match — proactively suggest the nearest real NGOs/buyers for
    this batch instead of waiting for someone to browse the marketplace.

    Partner type is picked based on the batch's recommended_action:
      donate                -> NGOs only
      markdown / fast_track  -> buyers only (NGOs shown too if none found)
      hold                   -> no match needed yet

    Data flow: this is a LIVE lookup against OpenStreetMap (via
    find_live_partners), centered on the batch's own lat/lng - not a fixed
    list. So a batch logged in Mumbai gets real Mumbai-area NGOs, a batch
    in Chennai gets real Chennai-area NGOs, etc. Only if the live lookup
    times out / the network is unavailable / OSM has nothing nearby do we
    fall back to the small seeded `partners` table as a safety net (each
    match is tagged with "source" = "openstreetmap" or "seed_data" so the
    frontend/demo can be transparent about which one is showing).

    Ranked by distance (haversine) from the batch's own coordinates.
    Returns whatever contact fields each partner actually has (contact,
    website, address, image_url) - the frontend falls back gracefully
    when a field is missing instead of assuming a phone number exists.
    """
    with get_conn() as conn:
        batch = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        if batch["latitude"] is None or batch["longitude"] is None:
            return {
                "batch_id": batch_id,
                "matches": [],
                "message": "Batch has no coordinates logged, cannot compute matches.",
            }

        action = batch["recommended_action"]
        if action == "hold":
            return {
                "batch_id": batch_id,
                "matches": [],
                "message": "Batch is currently on hold, no rescue match needed yet.",
            }
        if action == "compost":
            return {
                "batch_id": batch_id,
                "matches": [],
                "message": "Batch is past the point of donation and marked for composting - no buyer/NGO match needed.",
            }

        wanted_type = "ngo" if action == "donate" else "buyer"
        lat, lng = batch["latitude"], batch["longitude"]

        # --- 1. Live data flow: query real partners near this batch's location ---
        scored = find_live_partners(lat, lng, wanted_type, limit=limit)

        # If donate had zero live NGOs nearby, don't leave the seller with nothing -
        # widen to buyers too (mirrors the old "fall back to all partners" behavior).
        if not scored and wanted_type == "ngo":
            scored = find_live_partners(lat, lng, "buyer", limit=limit)

        source = "openstreetmap" if scored else None

        # --- 2. Safety-net fallback: seeded table, only if live data came up empty ---
        if not scored:
            partners = conn.execute(
                "SELECT * FROM partners WHERE partner_type = ?", (wanted_type,)
            ).fetchall()
            if not partners:
                partners = conn.execute("SELECT * FROM partners").fetchall()

            for p in partners:
                dist = haversine_km(lat, lng, p["latitude"], p["longitude"])
                scored.append({
                    "id": p["id"],
                    "name": p["name"],
                    "partner_type": p["partner_type"],
                    "contact": p["contact"],
                    "website": p["website"],
                    "address": p["address"],
                    "image_url": p["image_url"],
                    "notes": p["notes"],
                    "is_placeholder": bool(p["is_placeholder"]),
                    "source": "seed_data",
                    "distance_km": round(dist, 1),
                })
            scored.sort(key=lambda x: x["distance_km"])
            source = "seed_data" if scored else None

    return {
        "batch_id": batch_id,
        "recommended_action": action,
        "matches": scored[:limit],
        "source": source,
    }


@app.post("/batches/{batch_id}/claim", response_model=BatchResponse)
def claim_batch(batch_id: int, claim: ClaimRequest):
    """Buyer or NGO claims a batch that was marked for markdown/donation/fast-track."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Batch not found")
        if row["status"] in ("claimed", "completed"):
            raise HTTPException(status_code=409, detail="Batch already claimed")

        conn.execute(
            "UPDATE batches SET status = 'claimed', claimed_by = ?, claimed_contact = ?, claimed_at = ? WHERE id = ?",
            (claim.claimed_by, claim.contact, datetime.now().isoformat(), batch_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()

    return row_to_dict(updated)


@app.post("/batches/{batch_id}/complete", response_model=BatchResponse)
def complete_batch(batch_id: int):
    """
    Seller confirms the claimed batch was actually picked up. This turns an
    unverified claim into a verified rescue for the impact dashboard - so
    'kg rescued' reflects produce that really left the mandi, not just a
    claim someone made and never followed through on.
    """
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Batch not found")
        if row["status"] != "claimed":
            raise HTTPException(status_code=400, detail="Batch must be claimed before it can be marked picked up")

        conn.execute(
            "UPDATE batches SET status = 'completed', completed_at = ? WHERE id = ?",
            (datetime.now().isoformat(), batch_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()

    return row_to_dict(updated)


@app.get("/impact", response_model=ImpactResponse)
def get_impact_metrics():
    """
    Aggregate metrics for the dashboard 'impact' counter - the strongest demo visual.

    NOTE: 'rescued' counts both claimed and completed batches (produce that's
    been taken off the at-risk pile), while batches_in_progress/kg_in_progress
    isolate the ones that are claimed but not yet confirmed picked up, so the
    UI can show "verified" vs "in progress" if it wants to.
    """
    with get_conn() as conn:
        total_batches = conn.execute("SELECT COUNT(*) as c FROM batches").fetchone()["c"]
        total_kg_listed = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches"
        ).fetchone()["total"]

        expired = conn.execute("SELECT COUNT(*) as c FROM batches WHERE status = 'expired'").fetchone()["c"]
        composted = conn.execute("SELECT COUNT(*) as c FROM batches WHERE status = 'compost'").fetchone()["c"]
        kg_composted = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches WHERE status = 'compost'"
        ).fetchone()["total"]

        rescued_count = conn.execute(
            "SELECT COUNT(*) as c FROM batches WHERE status IN ('claimed', 'completed')"
        ).fetchone()["c"]
        kg_rescued = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches WHERE status IN ('claimed', 'completed')"
        ).fetchone()["total"]

        in_progress_count = conn.execute(
            "SELECT COUNT(*) as c FROM batches WHERE status = 'claimed'"
        ).fetchone()["c"]
        kg_in_progress = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches WHERE status = 'claimed'"
        ).fetchone()["total"]

        kg_at_risk = conn.execute(
            "SELECT COALESCE(SUM(quantity_kg), 0) as total FROM batches WHERE status IN ('risk', 'urgent')"
        ).fetchone()["total"]

        # Revenue recovered = discounted price x quantity, for rescued batches that had a listed price.
        priced_rescued = conn.execute(
            """
            SELECT quantity_kg, price_per_kg, discount_pct FROM batches
            WHERE status IN ('claimed', 'completed') AND price_per_kg IS NOT NULL
            """
        ).fetchall()
        revenue_recovered = sum(
            r["quantity_kg"] * r["price_per_kg"] * (1 - (r["discount_pct"] or 0) / 100)
            for r in priced_rescued
        )

    return {
        "total_batches_logged": total_batches,
        "total_kg_listed": round(total_kg_listed, 1),
        "batches_rescued": rescued_count,
        "batches_in_progress": in_progress_count,
        "batches_expired": expired,
        "batches_composted": composted,
        "kg_rescued": round(kg_rescued, 1),
        "kg_in_progress": round(kg_in_progress, 1),
        "kg_currently_at_risk": round(kg_at_risk, 1),
        "kg_composted": round(kg_composted, 1),
        "revenue_recovered": round(revenue_recovered, 2),
    }


@app.get("/")
def root():
    return {"message": "Rescue OS API is running. See /docs for the interactive API explorer."}