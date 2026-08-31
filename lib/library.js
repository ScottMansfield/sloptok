export function clipPublicUrl(file, env = process.env) {
  const name = String(file || "").replace(/^\/+/, "");
  const cdn = env.CDN_BASE_URL;
  if (cdn && String(cdn).trim()) {
    return `${String(cdn).replace(/\/$/, "")}/clips/${name}`;
  }
  return `/api/media/${name}`;
}

export function emptyLibrary(poolSize = 20) {
  return {
    version: 1,
    poolSize,
    promptSeq: 0,
    lastRefreshAt: 0,
    slots: [],
  };
}

export function parseLibrary(raw) {
  if (!raw) return emptyLibrary();
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object") return emptyLibrary();
  const slots = Array.isArray(data.slots) ? data.slots : [];
  return {
    version: data.version || 1,
    poolSize: data.poolSize || 20,
    promptSeq: typeof data.promptSeq === "number" ? data.promptSeq : slots.length,
    lastRefreshAt: data.lastRefreshAt || 0,
    slots: [...slots],
    pending: data.pending && typeof data.pending === "object" ? data.pending : {},
  };
}

export function appendLibraryRecord(library, record) {
  const next = parseLibrary(library);
  const requestId = record?.requestId || record?.request_id;
  if (requestId && next.slots.some((s) => (s.requestId || s.request_id) === requestId)) {
    return { library: next, appended: false, reason: "idempotent", slot: record.slot };
  }
  const slot = record.slot != null ? Number(record.slot) : next.slots.length;
  const rec = { ...record, slot };
  next.slots = [...next.slots, rec];
  next.promptSeq = Math.max(next.promptSeq || 0, slot + 1, next.slots.length);
  next.lastRefreshAt = rec.createdAt || Date.now();
  return { library: next, appended: true, slot };
}

export async function loadLibrary(gcs) {
  if (!gcs) return emptyLibrary();
  const text = await gcs.getObjectText("library.json");
  if (!text) return emptyLibrary();
  try {
    return parseLibrary(text);
  } catch {
    return emptyLibrary();
  }
}

export async function saveLibrary(gcs, library) {
  await gcs.putObject("library.json", JSON.stringify(library, null, 2), "application/json");
  return library;
}
