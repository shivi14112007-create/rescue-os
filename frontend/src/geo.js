/**
 * Geolocation helpers for Rescue OS.
 *
 * getBrowserLocation()      - wraps navigator.geolocation in a promise, with a short
 *                              in-memory + localStorage cache so switching between the
 *                              Add Batch form and Marketplace doesn't re-prompt for
 *                              permission every time (same idea GoMocha uses: fetch
 *                              location once, reuse it across the session).
 * reverseGeocode()          - turns lat/lng into a human-readable address via
 *                              OpenStreetMap's free Nominatim API (no key needed)
 * distanceKm()               - haversine distance between two lat/lng points
 * filterAndSortByDistance() - radius-filter + nearest-first sort, mirroring the
 *                              "shops within N meters, sorted by distance" pattern
 *                              used by production food-rescue/delivery apps
 */

const CACHE_KEY = "rescueos:lastLocation";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes - long enough to survive page switches,
                                       // short enough that a moving seller/buyer stays accurate

function readCachedLocation() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { latitude, longitude, accuracy, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt > CACHE_TTL_MS) return null;
    return { latitude, longitude, accuracy };
  } catch {
    return null; // corrupt cache or localStorage unavailable (e.g. private browsing) - ignore
  }
}

function writeCachedLocation(loc) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...loc, cachedAt: Date.now() }));
  } catch {
    // localStorage can throw in private/incognito modes - caching is a nice-to-have, not required
  }
}

export function getBrowserLocation({ timeout = 10000, forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = readCachedLocation();
    if (cached) return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation isn't supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        writeCachedLocation(loc);
        resolve(loc);
      },
      (err) => {
        // Map raw GeolocationPositionError codes to friendlier messages
        const messages = {
          1: "Location access was denied. Enable it in your browser settings to use this.",
          2: "Your location couldn't be determined right now.",
          3: "Getting your location took too long. Try again.",
        };
        reject(new Error(messages[err.code] || "Couldn't get your location."));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

export async function reverseGeocode(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=16`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Reverse geocoding failed.");
  const data = await res.json();

  // Prefer a short, human-friendly label (area + city) over the full address string
  const addr = data.address || {};
  const area =
    addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district;
  const city = addr.city || addr.town || addr.county;
  const label = [area, city].filter(Boolean).join(", ");

  return label || data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Attach distance from `origin` to every item with lat/lng, sort nearest-first,
 * and optionally drop anything beyond `radiusKm`. Items without coordinates keep
 * a distance of Infinity so they sort last instead of being silently dropped
 * (unless a radius is set, in which case they're excluded like out-of-range items).
 */
export function filterAndSortByDistance(items, origin, { radiusKm = null, getCoords } = {}) {
  const withDistance = items.map((item) => {
    const coords = getCoords ? getCoords(item) : item;
    const hasCoords = coords?.latitude != null && coords?.longitude != null;
    const distance = hasCoords
      ? distanceKm(origin.latitude, origin.longitude, coords.latitude, coords.longitude)
      : Infinity;
    return { ...item, _distanceKm: distance };
  });

  const inRange =
    radiusKm == null ? withDistance : withDistance.filter((i) => i._distanceKm <= radiusKm);

  return inRange.sort((a, b) => a._distanceKm - b._distanceKm);
}
