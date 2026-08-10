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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS partners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                partner_type TEXT NOT NULL,     -- 'ngo' or 'buyer'
                contact TEXT,                   -- phone/WhatsApp number, if publicly available
                website TEXT,                   -- official website/contact-form link, if available
                address TEXT,                   -- human-readable office/area label
                image_url TEXT,                 -- logo/photo URL, if available (may be NULL)
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                notes TEXT,
                is_placeholder INTEGER DEFAULT 0  -- 1 = example entry, not a verified real partner yet
            )
        """)
        conn.commit()
        _run_migrations(conn)
        _seed_partners(conn)


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
        # Produce Vision - filled in when the seller's photo was analyzed
        # via POST /vision/analyze-image before batch creation.
        "quality_label": "TEXT",
        "quality_score": "INTEGER",
        "vision_source": "TEXT",
    }

    existing_cols = {row["name"] for row in conn.execute("PRAGMA table_info(batches)").fetchall()}
    for col, col_type in expected_columns.items():
        if col not in existing_cols:
            conn.execute(f"ALTER TABLE batches ADD COLUMN {col} {col_type}")

    partner_expected = {
        "website": "TEXT",
        "address": "TEXT",
        "image_url": "TEXT",
        "is_placeholder": "INTEGER DEFAULT 0",
    }
    partner_existing = {row["name"] for row in conn.execute("PRAGMA table_info(partners)").fetchall()}
    for col, col_type in partner_expected.items():
        if col not in partner_existing:
            conn.execute(f"ALTER TABLE partners ADD COLUMN {col} {col_type}")

    conn.commit()


def _seed_partners(conn):
    """
    Registered NGOs/buyers used for auto-matching (Rescue Match feature).
    Runs on every startup but only inserts if the table is empty, so it's
    safe to call repeatedly and needs no separate seed script.

    NGO entries use real, publicly-published info (website/phone/office as
    available at time of writing) - see README note below each entry for
    what's confirmed vs unknown. Buyer entries are explicitly marked as
    placeholders (is_placeholder=1) because no public directory of "buys
    discounted near-expiry produce" wholesalers exists - replace these with
    a real local buyer's details (with their consent) before a live demo.
    """
    count = conn.execute("SELECT COUNT(*) AS c FROM partners").fetchone()["c"]
    if count > 0:
        return

    partners = [
        # name, type, contact, website, address, image_url, lat, lng, notes, is_placeholder
        (
            "Robin Hood Army - Delhi",
            "ngo",
            "+91 89719 66164",  # public WhatsApp number from their official Instagram bio
            "https://robinhoodarmy.com",
            "Decentralized - no fixed pickup office, coordinated via WhatsApp/website per city chapter",
            None,
            28.5494, 77.2001,  # Hauz Khas, Delhi - where RHA originally started (symbolic anchor point)
            "Zero-funds volunteer network; only distributes food fit for volunteers to eat themselves. "
            "Best for same-day surplus pickup, not scheduled bulk donation.",
            0,
        ),
        (
            "Goonj",
            "ngo",
            "011-41401216",
            "https://goonj.org",
            "J-93, Sarita Vihar, New Delhi - 110076",
            None,
            28.5335, 77.2870,  # Sarita Vihar, Delhi (approx)
            "Primarily material/clothing relief; food donations mainly flow through their disaster-relief "
            "(Rahat) program - confirm current food-acceptance capacity before routing large produce batches here.",
            0,
        ),
        (
            "Feeding India (by Zomato)",
            "ngo",
            None,  # no public phone number found - website contact form is the real intake route
            "https://www.feedingindia.org",
            "2nd Floor, Plot 13, LSC Pocket 1, Vasant Kunj, New Delhi - 110070",
            None,
            28.5244, 77.1600,  # Vasant Kunj, Delhi (approx)
            "Runs the Daily Feeding Program across partner schools; reach out via their website for "
            "bulk/recurring produce donations.",
            0,
        ),
        (
            "Example Wholesale Buyer (replace me)",
            "buyer",
            None,
            None,
            "Add your real local mandi/wholesale buyer here",
            None,
            28.7069, 77.1746,  # Azadpur Mandi, Delhi (placeholder location)
            "Placeholder only - swap for a real buyer's verified contact before a live demo.",
            1,
        ),
        (
            "Example Retail Partner (replace me)",
            "buyer",
            None,
            None,
            "Add your real local retail/kirana buyer here",
            None,
            28.6258, 77.3238,  # Ghazipur Mandi, Delhi (placeholder location)
            "Placeholder only - swap for a real buyer's verified contact before a live demo.",
            1,
        ),
    ]
    conn.executemany(
        """
        INSERT INTO partners
            (name, partner_type, contact, website, address, image_url, latitude, longitude, notes, is_placeholder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        partners,
    )
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
