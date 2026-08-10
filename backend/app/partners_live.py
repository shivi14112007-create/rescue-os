"""
Live partner discovery for Rescue Match.

Replaces the old "3 hardcoded Delhi NGOs" approach with a real, worldwide
data flow: we query OpenStreetMap's free Overpass API for organizations
tagged as NGOs / food banks / charities / social facilities (for the
"donate" action) or wholesale markets / supermarkets (for "markdown" /
"fast_track"), centered on the batch's own coordinates.

No API key required (same free-tier philosophy as geo.js's use of
Nominatim on the frontend). Because OSM coverage is crowd-sourced and
therefore uneven, we:
  1. search a small radius first, then progressively widen it if too few
     results come back (dense city vs rural area),
  2. cache responses in-memory for a few minutes so repeated dashboard
     views/re-renders don't hammer the public Overpass endpoint,
  3. try multiple public Overpass mirrors in case one is rate-limited,
  4. always fail soft - on any network error / empty result the caller
     (main.py) falls back to the seeded `partners` table instead of
     breaking the demo.
"""
import time
from math import radians, sin, cos, sqrt, atan2

import httpx

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# Widen the search ring until we have enough results, so a batch logged in
# a dense city doesn't need to search far, but one logged somewhere rural
# still finds *something* instead of coming back empty.
SEARCH_RINGS_KM = [10, 25, 60, 120]

REQUEST_TIMEOUT_S = 8.0
CACHE_TTL_S = 10 * 60  # 10 minutes

_cache: dict[str, tuple[float, list[dict]]] = {}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


# Overpass tag filters per partner type we care about.
NGO_FILTERS = [
    '["office"="ngo"]',
    '["social_facility"]',
    '["amenity"="food_bank"]',
    '["amenity"="social_facility"]',
    '["shop"="charity"]',
]
BUYER_FILTERS = [
    '["shop"="wholesale"]',
    '["amenity"="marketplace"]',
    '["shop"="supermarket"]',
    '["shop"="greengrocer"]',
]


def _build_query(lat: float, lng: float, radius_km: float, filters: list[str]) -> str:
    radius_m = int(radius_km * 1000)
    clauses = []
    for f in filters:
        clauses.append(f'node{f}(around:{radius_m},{lat},{lng});')
        clauses.append(f'way{f}(around:{radius_m},{lat},{lng});')
    body = "\n  ".join(clauses)
    return f"""
[out:json][timeout:{int(REQUEST_TIMEOUT_S)}];
(
  {body}
);
out center tags 30;
"""


def _query_overpass(query: str) -> list[dict]:
    """Try each mirror in turn; return raw Overpass 'elements', or [] on total failure."""
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            resp = httpx.post(
                endpoint,
                data={"data": query},
                timeout=REQUEST_TIMEOUT_S,
                headers={"User-Agent": "RescueOS/1.0 (food-rescue-matching)"},
            )
            resp.raise_for_status()
            return resp.json().get("elements", [])
        except Exception as e:  # noqa: BLE001 - genuinely any failure should just try next mirror
            last_err = e
            continue
    if last_err:
        # Swallow the error - caller falls back to seeded partners.
        pass
    return []


def _element_to_partner(el: dict, partner_type: str) -> dict | None:
    tags = el.get("tags", {})
    name = tags.get("name")
    if not name:
        return None  # unnamed entries aren't useful to show a seller/buyer

    if el["type"] == "node":
        lat, lng = el.get("lat"), el.get("lon")
    else:  # way/relation - Overpass gives us a computed center
        center = el.get("center") or {}
        lat, lng = center.get("lat"), center.get("lon")
    if lat is None or lng is None:
        return None

    contact = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("contact:mobile")
    )
    whatsapp = tags.get("contact:whatsapp")
    website = tags.get("website") or tags.get("contact:website") or tags.get("url")
    email = tags.get("email") or tags.get("contact:email")

    addr_parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb"),
        tags.get("addr:city"),
    ]
    address = ", ".join(p for p in addr_parts if p) or None

    notes = tags.get("description") or tags.get("social_facility:for") or None

    return {
        "id": f"osm:{el['type']}:{el['id']}",
        "name": name,
        "partner_type": partner_type,
        "contact": contact,
        "whatsapp": whatsapp,
        "website": website,
        "email": email,
        "address": address,
        "image_url": None,
        "notes": notes,
        "is_placeholder": False,
        "source": "openstreetmap",
        "latitude": lat,
        "longitude": lng,
        "wikidata": tags.get("wikidata"),
    }


WIKIDATA_CACHE_TTL_S = 24 * 60 * 60  # official websites rarely change - cache a full day
_wikidata_cache: dict[str, dict] = {}


def _wikidata_claim_value(claims: dict, prop: str) -> str | None:
    try:
        return claims[prop][0]["mainsnak"]["datavalue"]["value"]
    except (KeyError, IndexError, TypeError):
        return None


def _enrich_from_wikidata(partner: dict) -> None:
    """
    OSM often only records name/location/type for an org and leaves phone/
    website blank. But many real NGOs (SOS Children's Villages, ICRC, etc.)
    are also linked to a Wikidata item via OSM's `wikidata` tag, and
    Wikidata *does* reliably hold the official website (P856) and
    sometimes email (P968) / phone (P1329) for notable organizations.
    This fills those gaps in-place; it's a best-effort lookup and silently
    does nothing on any failure.
    """
    qid = partner.get("wikidata")
    if not qid or (partner.get("website") and partner.get("contact")):
        return  # nothing to look up, or already fully populated

    now = time.time()
    cached = _wikidata_cache.get(qid)
    if cached and (now - cached["_cached_at"]) < WIKIDATA_CACHE_TTL_S:
        data = cached
    else:
        try:
            resp = httpx.get(
                f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json",
                timeout=REQUEST_TIMEOUT_S,
                headers={"User-Agent": "RescueOS/1.0 (food-rescue-matching)"},
            )
            resp.raise_for_status()
            entity = resp.json()["entities"][qid]
            claims = entity.get("claims", {})
            data = {
                "website": _wikidata_claim_value(claims, "P856"),
                "email": _wikidata_claim_value(claims, "P968"),
                "phone": _wikidata_claim_value(claims, "P1329"),
                "_cached_at": now,
            }
            _wikidata_cache[qid] = data
        except Exception:  # noqa: BLE001 - best-effort enrichment, never breaks the request
            return

    if not partner.get("website") and data.get("website"):
        partner["website"] = data["website"]
    if not partner.get("email") and data.get("email"):
        partner["email"] = data["email"]
    if not partner.get("contact") and data.get("phone"):
        partner["contact"] = data["phone"]


def find_live_partners(lat: float, lng: float, partner_type: str, limit: int = 3) -> list[dict]:
    """
    Live-query real NGOs (`partner_type="ngo"`) or wholesale/retail buyers
    (`partner_type="buyer"`) near (lat, lng), ranked nearest-first.

    Returns [] (never raises) if the network is unavailable or nothing is
    found within the widest search ring - the caller is expected to fall
    back to the seeded `partners` table in that case.
    """
    filters = NGO_FILTERS if partner_type == "ngo" else BUYER_FILTERS

    cache_key = f"{partner_type}:{round(lat, 2)}:{round(lng, 2)}:{limit}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and (now - cached[0]) < CACHE_TTL_S:
        return cached[1]

    results: dict[str, dict] = {}
    for radius_km in SEARCH_RINGS_KM:
        query = _build_query(lat, lng, radius_km, filters)
        elements = _query_overpass(query)

        for el in elements:
            partner = _element_to_partner(el, partner_type)
            if not partner:
                continue
            partner["distance_km"] = round(
                haversine_km(lat, lng, partner["latitude"], partner["longitude"]), 1
            )
            results[partner["id"]] = partner  # de-dupe across widening rings

        # Stop widening as soon as we have comfortably more than `limit`
        # candidates to rank, so we don't over-fetch a huge radius.
        if len(results) >= max(limit * 3, 6):
            break

    ranked = sorted(results.values(), key=lambda p: p["distance_km"])[:limit]

    # Only enrich the handful actually shown to the user - not every
    # candidate found - to keep this fast.
    for partner in ranked:
        _enrich_from_wikidata(partner)
        partner.pop("wikidata", None)  # internal-only, not needed by the frontend

    _cache[cache_key] = (now, ranked)
    return ranked
