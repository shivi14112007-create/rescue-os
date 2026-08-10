// In dev this falls back to your local backend. On a deployed build, set
// VITE_API_BASE_URL to your deployed backend's URL (e.g. in a .env.production
// file or your hosting platform's env vars) - otherwise every API call here
// silently tries to reach http://127.0.0.1:8000 inside each visitor's own
// browser, which never exists on a deployed site.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function createBatch(batch) {
  const res = await fetch(`${BASE_URL}/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  return handleResponse(res);
}

export async function analyzeProduceImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/vision/analyze-image`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function previewBatch(batch) {
  const res = await fetch(`${BASE_URL}/batches/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  return handleResponse(res);
}

export async function listBatches(status, near) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (near) {
    params.set("near_lat", near.latitude);
    params.set("near_lng", near.longitude);
  }
  const query = params.toString();
  const res = await fetch(`${BASE_URL}/batches${query ? `?${query}` : ""}`);
  return handleResponse(res);
}

export async function claimBatch(id, claimedBy, contact) {
  const res = await fetch(`${BASE_URL}/batches/${id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimed_by: claimedBy, contact: contact || null }),
  });
  return handleResponse(res);
}

export async function completeBatch(id) {
  const res = await fetch(`${BASE_URL}/batches/${id}/complete`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function getMatches(id) {
  const res = await fetch(`${BASE_URL}/automation/${id}/match`);
  return handleResponse(res);
}

export async function getNearbyPartners(lat, lng, limit = 8) {
  const params = new URLSearchParams({ lat, lng, limit });
  const res = await fetch(`${BASE_URL}/partners/nearby?${params.toString()}`);
  return handleResponse(res);
}

export async function getImpact() {
  const res = await fetch(`${BASE_URL}/impact`);
  return handleResponse(res);
}