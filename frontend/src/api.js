const BASE_URL = "http://127.0.0.1:8000";

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

export async function getImpact() {
  const res = await fetch(`${BASE_URL}/impact`);
  return handleResponse(res);
}