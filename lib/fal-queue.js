const QUEUE_BASE = "https://queue.fal.run";

function falKey(deps = {}) {
  const key = deps.falKey ?? process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  return key;
}

function authHeaders(deps = {}) {
  return {
    Authorization: `Key ${falKey(deps)}`,
    Accept: "application/json",
  };
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function queueSubmitUrl(model) {
  return `${QUEUE_BASE}/${model}`;
}

export function queueStatusUrl(model, requestId) {
  return `${QUEUE_BASE}/${model}/requests/${requestId}/status`;
}

export function queueResultUrl(model, requestId) {
  return `${QUEUE_BASE}/${model}/requests/${requestId}`;
}

export async function queueSubmit(model, input, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let url = queueSubmitUrl(model);
  if (deps.webhookUrl) {
    const u = new URL(url);
    u.searchParams.set("fal_webhook", deps.webhookUrl);
    url = u.toString();
  }
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      ...authHeaders(deps),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await readJson(res);
  if (!res.ok) {
    const detail = data.detail || data.msg || data.message || res.statusText;
    throw new Error(`fal submit ${res.status}: ${detail}`);
  }
  const requestId = data.request_id || data.requestId;
  if (!requestId) throw new Error("fal submit missing request_id");
  return { requestId, status: data.status || "IN_QUEUE", raw: data };
}

export async function queueStatus(model, requestId, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(queueStatusUrl(model, requestId), {
    method: "GET",
    headers: authHeaders(deps),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(`fal status ${res.status}`);
  }
  return data;
}

export async function queueResult(model, requestId, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(queueResultUrl(model, requestId), {
    method: "GET",
    headers: authHeaders(deps),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(`fal result ${res.status}`);
  }
  return data;
}

export async function pollUntilDone(model, requestId, opts = {}) {
  const intervalMs = opts.intervalMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 180000;
  const fetchImpl = opts.fetchImpl;
  const falKey = opts.falKey;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const start = now();

  while (true) {
    const status = await queueStatus(model, requestId, { fetchImpl, falKey });
    const s = status.status;
    if (s === "COMPLETED") {
      return queueResult(model, requestId, { fetchImpl, falKey });
    }
    if (s === "FAILED" || s === "CANCELLED") {
      const err = status.error || status.detail || s;
      throw new Error(`fal job ${s}: ${err}`);
    }
    if (now() - start > timeoutMs) {
      throw new Error(`fal poll timeout after ${timeoutMs}ms`);
    }
    await sleep(intervalMs);
  }
}

export function extractVideoUrl(result) {
  if (!result) return null;
  if (result.video?.url) return result.video.url;
  if (result.data?.video?.url) return result.data.video.url;
  return null;
}

export function extractImageUrl(result) {
  if (!result) return null;
  const images = result.images || result.data?.images;
  if (Array.isArray(images) && images[0]?.url) return images[0].url;
  if (result.image?.url) return result.image.url;
  return null;
}
