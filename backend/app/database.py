"""
Database layer for Rescue OS.
Uses SQLite (stdlib sqlite3) - zero setup, single file DB.
Good enough for a hackathon demo; swap for Postgres later if needed.
"""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "rescue_os.db"


def init_db():
    """Create tables if they don't exist. Call this once on app startup."""
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                produce_type TEXT NOT NULL,
                quantity_kg REAL NOT NULL,
                harvest_date TEXT NOT NULL,
                storage_condition TEXT NOT NULL,
                location TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                seller_name TEXT,
                price_per_kg REAL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),

                -- computed fields (filled after estimation + agent call)
                remaining_shelf_life_days REAL,
                status TEXT DEFAULT 'pending',        -- pending / fresh / risk / urgent / claimed / expired
                recommended_action TEXT,               -- hold / markdown / donate / fast_track
                discount_pct REAL,
                agent_reasoning TEXT,
                agent_source TEXT,                     -- which provider answered: groq:<model> / gemini:<model> / rule_based

                -- marketplace fields
                claimed_by TEXT,
                claimed_contact TEXT,
                claimed_at TEXT,
                completed_at TEXT              -- set when seller confirms pickup actually happened
            )
        """)
        conn.commit()
        _run_migrations(conn)


def _run_migrations(conn):
    """
    Defensive migration: checks EVERY column the app expects and adds
    whichever ones are missing from the existing table. This makes the
    app self-heal against any older/partial rescue_os.db (e.g. one
    created before price_per_kg, notes, or the claim/complete fields
    existed) instead of crashing with 'no such column'.
    """
    expected_columns = {
        "produce_type": "TEXT",
        "quantity_kg": "REAL",
        "harvest_date": "TEXT",
        "storage_condition": "TEXT",
        "location": "TEXT",
        "latitude": "REAL",
        "longitude": "REAL",
        "seller_name": "TEXT",
        "price_per_kg": "REAL",
        "notes": "TEXT",
        "created_at": "TEXT",
        "remaining_shelf_life_days": "REAL",
        "status": "TEXT",
        "recommended_action": "TEXT",
        "discount_pct": "REAL",
        "agent_reasoning": "TEXT",
        "agent_source": "TEXT",
        "claimed_by": "TEXT",
        "claimed_contact": "TEXT",
        "claimed_at": "TEXT",
        "completed_at": "TEXT",
    }

    existing_cols = {row["name"] for row in conn.execute("PRAGMA table_info(batches)").fetchall()}
    for col, col_type in expected_columns.items():
        if col not in existing_cols:
            conn.execute(f"ALTER TABLE batches ADD COLUMN {col} {col_type}")
    conn.commit()


@contextmanager
def get_conn():
    """Context manager so we always close the connection properly."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us access columns by name
    try:
        yield conn
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row) if row else None