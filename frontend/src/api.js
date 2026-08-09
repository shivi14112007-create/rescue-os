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

export async function listBatches(status) {
  const url = status ? `${BASE_URL}/batches?status=${status}` : `${BASE_URL}/batches`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function claimBatch(id, claimedBy) {
  const res = await fetch(`${BASE_URL}/batches/${id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimed_by: claimedBy }),
  });
  return handleResponse(res);
}

export async function getImpact() {
  const res = await fetch(`${BASE_URL}/impact`);
  return handleResponse(res);
}
