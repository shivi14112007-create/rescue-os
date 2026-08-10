"""
Seed script (v2) - matches the latest schema (lat/lng, claim contact, complete step).
Backend must already be running: uvicorn app.main:app --reload  (http://127.0.0.1:8000)

Run: python seed_demo_data.py
"""
import os
import sys
import requests
from datetime import date, timedelta

# Priority: command-line arg > BACKEND_URL env var > local dev default.
# To seed a deployed backend:
#   python seed_demo_data.py https://your-backend.onrender.com
# or:
#   BACKEND_URL=https://your-backend.onrender.com python seed_demo_data.py
BASE_URL = (
    sys.argv[1] if len(sys.argv) > 1
    else os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
).rstrip("/")

print(f"Seeding against: {BASE_URL}\n")

def d(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()

# Real Delhi mandi coordinates so the map / distance-sort actually works
batches = [
    # fresh
    {"produce_type": "tomato", "quantity_kg": 500, "harvest_date": d(1), "storage_condition": "cold_storage",
     "location": "Azadpur Mandi, Delhi", "latitude": 28.7069, "longitude": 77.1746,
     "seller_name": "Ramesh Traders", "price_per_kg": 30},
    {"produce_type": "apple", "quantity_kg": 800, "harvest_date": d(3), "storage_condition": "refrigerated",
     "location": "Narela Mandi, Delhi", "latitude": 28.8480, "longitude": 77.0920,
     "seller_name": "Himalayan Fresh", "price_per_kg": 90},
    {"produce_type": "potato", "quantity_kg": 1200, "harvest_date": d(5), "storage_condition": "cold_storage",
     "location": "Ghazipur Mandi, Delhi", "latitude": 28.6258, "longitude": 77.3238,
     "seller_name": "Singh Aggregators", "price_per_kg": 18},

    # risk (1-3 days left)
    {"produce_type": "banana", "quantity_kg": 300, "harvest_date": d(3), "storage_condition": "room_temp",
     "location": "Okhla Mandi, Delhi", "latitude": 28.5355, "longitude": 77.2910,
     "seller_name": "Fresh Fruits Co", "price_per_kg": 25},
    {"produce_type": "mango", "quantity_kg": 250, "harvest_date": d(4), "storage_condition": "room_temp",
     "location": "Azadpur Mandi, Delhi", "latitude": 28.7069, "longitude": 77.1746,
     "seller_name": "Malda Mango Traders", "price_per_kg": 60},
    {"produce_type": "cauliflower", "quantity_kg": 150, "harvest_date": d(3), "storage_condition": "room_temp",
     "location": "Keshopur Mandi, Delhi", "latitude": 28.6608, "longitude": 77.0764,
     "seller_name": "Green Farms", "price_per_kg": 20},

    # urgent (<=1 day left)
    {"produce_type": "spinach", "quantity_kg": 80, "harvest_date": d(2), "storage_condition": "room_temp",
     "location": "Ghazipur Mandi, Delhi", "latitude": 28.6258, "longitude": 77.3238,
     "seller_name": "Leafy Greens Co", "price_per_kg": 15},
    {"produce_type": "grapes", "quantity_kg": 40, "harvest_date": d(6), "storage_condition": "room_temp",
     "location": "Azadpur Mandi, Delhi", "latitude": 28.7069, "longitude": 77.1746,
     "seller_name": "Nashik Grapes", "price_per_kg": 45},
    {"produce_type": "papaya", "quantity_kg": 60, "harvest_date": d(4), "storage_condition": "room_temp",
     "location": "Okhla Mandi, Delhi", "latitude": 28.5355, "longitude": 77.2910,
     "seller_name": "Tropical Fruits", "price_per_kg": 20},

    # expired (should trigger donate)
    {"produce_type": "tomato", "quantity_kg": 100, "harvest_date": d(10), "storage_condition": "room_temp",
     "location": "Narela Mandi, Delhi", "latitude": 28.8480, "longitude": 77.0920,
     "seller_name": "Ramesh Traders", "price_per_kg": 30},
    {"produce_type": "spinach", "quantity_kg": 30, "harvest_date": d(5), "storage_condition": "room_temp",
     "location": "Keshopur Mandi, Delhi", "latitude": 28.6608, "longitude": 77.0764,
     "seller_name": "Leafy Greens Co", "price_per_kg": 15},
    {"produce_type": "banana", "quantity_kg": 120, "harvest_date": d(7), "storage_condition": "room_temp",
     "location": "Ghazipur Mandi, Delhi", "latitude": 28.6258, "longitude": 77.3238,
     "seller_name": "Fresh Fruits Co", "price_per_kg": 25},
]

print(f"Creating {len(batches)} batches...\n")
created = []
for b in batches:
    r = requests.post(f"{BASE_URL}/batches", json=b)
    if r.status_code == 200:
        row = r.json()
        print(f"✅ #{row['id']:<3} {row['produce_type']:12s} | {row['status']:8s} | {row['recommended_action']:10s} | {row['remaining_shelf_life_days']} days left | source={row['agent_source']}")
        created.append(row)
    else:
        print(f"❌ Failed: {b['produce_type']} -> {r.status_code} {r.text}")

print(f"\n{len(created)}/{len(batches)} batches created.")

# Claim a few risk/urgent batches so marketplace + impact numbers aren't zero
claimable = [b for b in created if b["status"] in ("risk", "urgent")]
to_claim = claimable[:3]
to_complete = claimable[:1]  # one of them goes all the way to "picked up"

for b in to_claim:
    r = requests.post(
        f"{BASE_URL}/batches/{b['id']}/claim",
        json={"claimed_by": "Robin Hood Army - Delhi Chapter", "contact": "+91 98765 43210"},
    )
    if r.status_code == 200:
        print(f"🤝 Claimed batch #{b['id']} ({b['produce_type']})")

for b in to_complete:
    r = requests.post(f"{BASE_URL}/batches/{b['id']}/complete")
    if r.status_code == 200:
        print(f"📦 Marked batch #{b['id']} as picked up / completed")

# Quick sanity check on the impact endpoint
impact = requests.get(f"{BASE_URL}/impact").json()
print("\n--- /impact snapshot ---")
for k, v in impact.items():
    print(f"{k}: {v}")

print("\nDone. Refresh your frontend dashboard now.")