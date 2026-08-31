export const PREFETCH = 2;
/** Initial fill target, not a max. Library grows by append-only refill. */
export const POOL_SIZE = 20;
export const REFRESH_MS = 1_800_000;

export function slotOf(feedIndex, poolSize = POOL_SIZE) {
  const size = Math.max(1, Number(poolSize) || POOL_SIZE);
  const n = Math.max(0, Number(feedIndex) || 0);
  return n % size;
}

function mediaFile(url) {
  if (!url) return null;
  const m = String(url).match(/\/(?:api\/media|clips)\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function createFeedMachine(opts = {}) {
  const prefetch = opts.prefetch ?? PREFETCH;
  const poolSize = Math.max(1, Number(opts.poolSize) || POOL_SIZE);
  const refreshMs = opts.refreshMs == null ? REFRESH_MS : Number(opts.refreshMs);
  const defaultModel = opts.defaultModel ?? "h3";
  const pickPrompt = opts.pickPrompt;
  if (typeof pickPrompt !== "function") {
    throw new Error("pickPrompt required");
  }
  const startT2V = opts.startT2V;
  const startFallback = opts.startFallback;
  const pollT2V = opts.pollT2V;
  const now = opts.now ?? Date.now;
  const persist = typeof opts.persist === "function" ? opts.persist : null;

  const slots = new Map();
  const counts = { t2v: new Map(), fallback: new Map(), t2vTotal: 0, fallbackTotal: 0 };
  let seq = 0;
  let lastRefreshAt = now();
  let lastFeedAt = 0;
  let currentModel = defaultModel;
  let refreshBusy = false;

  function bump(map, slot, kind) {
    map.set(slot, (map.get(slot) || 0) + 1);
    if (kind === "t2v") counts.t2vTotal += 1;
    else counts.fallbackTotal += 1;
  }

  function snapshot() {
    return {
      version: 1,
      poolSize,
      promptSeq: seq,
      lastRefreshAt,
      slots: [...slots.values()].map((clip) => ({
        slot: clip.slot,
        id: clip.id,
        generation: clip.generation,
        handle: clip.handle,
        caption: clip.caption,
        prompt: clip.prompt,
        model: clip.model,
        status: clip.status,
        requestId: clip.requestId,
        t2vUrl: clip.t2vUrl,
        fallbackUrl: clip.fallbackUrl,
        posterUrl: clip.posterUrl,
        t2vFile: mediaFile(clip.t2vUrl),
        fallbackFile: mediaFile(clip.fallbackUrl),
        posterFile: mediaFile(clip.posterUrl),
        createdAt: clip.createdAt,
        error: clip.error,
        fallbackError: clip.fallbackError,
        t2vStarted: clip.t2vStarted,
        fallbackStarted: clip.fallbackStarted,
      })),
    };
  }

  function save() {
    if (!persist) return;
    try {
      persist(snapshot());
    } catch {
      /* persist is best-effort */
    }
  }

  function makeClip(slot, modelName) {
    const generation = seq++;
    const seed = pickPrompt(generation);
    return {
      id: `slop-${slot}-${generation}`,
      index: slot,
      slot,
      generation,
      handle: seed.handle,
      caption: seed.caption,
      prompt: seed.prompt,
      model: modelName || currentModel || defaultModel,
      status: "pending",
      requestId: null,
      t2vUrl: null,
      fallbackUrl: null,
      posterUrl: null,
      startedAt: now(),
      createdAt: now(),
      t2vStarted: false,
      fallbackStarted: false,
      error: null,
      fallbackError: null,
    };
  }

  function restoreClip(rec) {
    const slot = rec.slot;
    const t2vUrl = rec.t2vUrl || (rec.t2vFile ? `/api/media/${rec.t2vFile}` : null);
    const fallbackUrl = rec.fallbackUrl || (rec.fallbackFile ? `/api/media/${rec.fallbackFile}` : null);
    const posterUrl = rec.posterUrl || (rec.posterFile ? `/api/media/${rec.posterFile}` : null);
    const playable = Boolean(t2vUrl || fallbackUrl || posterUrl);
    return {
      id: rec.id || `slop-${slot}-restored`,
      index: slot,
      slot,
      generation: rec.generation ?? slot,
      handle: rec.handle,
      caption: rec.caption,
      prompt: rec.prompt,
      model: rec.model || defaultModel,
      status: t2vUrl ? "ready" : fallbackUrl || posterUrl ? "fallback" : rec.status || "pending",
      requestId: rec.requestId || null,
      t2vUrl,
      fallbackUrl,
      posterUrl,
      startedAt: rec.createdAt || now(),
      createdAt: rec.createdAt || now(),
      t2vStarted: playable || Boolean(t2vUrl),
      fallbackStarted: playable || Boolean(fallbackUrl || posterUrl),
      error: rec.error || null,
      fallbackError: rec.fallbackError || null,
    };
  }

  function hydrateFrom(data) {
    if (!data || typeof data !== "object") return;
    if (typeof data.promptSeq === "number") seq = data.promptSeq;
    if (typeof data.lastRefreshAt === "number") lastRefreshAt = data.lastRefreshAt;
    const list = Array.isArray(data.slots) ? data.slots : [];
    for (const rec of list) {
      if (rec == null || rec.slot == null) continue;
      const slot = Number(rec.slot);
      if (!Number.isInteger(slot) || slot < 0) continue;
      slots.set(slot, restoreClip({ ...rec, slot }));
    }
  }

  if (opts.hydrate) hydrateFrom(opts.hydrate);

  function kick(clip) {
    if (startFallback && !clip.fallbackStarted) {
      clip.fallbackStarted = true;
      bump(counts.fallback, clip.slot, "fallback");
      clip._fallback = Promise.resolve()
        .then(() => startFallback(clip))
        .then((res) => {
          if (res?.videoUrl) clip.fallbackUrl = res.videoUrl;
          if (res?.posterUrl) clip.posterUrl = res.posterUrl;
          if (!clip.t2vUrl) clip.status = clip.fallbackUrl ? "fallback" : clip.status;
          save();
          return res;
        })
        .catch((err) => {
          clip.fallbackError = String(err?.message || err);
          save();
        });
    }
    if (startT2V && !clip.t2vStarted) {
      clip.t2vStarted = true;
      bump(counts.t2v, clip.slot, "t2v");
      if (!clip.fallbackUrl) clip.status = "generating";
      clip._t2v = Promise.resolve()
        .then(() => startT2V(clip))
        .then(async (res) => {
          if (res?.requestId) clip.requestId = res.requestId;
          save();
          if (!pollT2V) return res;
          const result = await pollT2V(clip);
          if (result?.videoUrl) {
            clip.t2vUrl = result.videoUrl;
            clip.status = "ready";
            save();
            return result;
          }
          clip.error = result?.error || "t2v incomplete";
          if (!clip.fallbackUrl) clip.status = "failed";
          else clip.status = "fallback";
          save();
          return result;
        })
        .catch((err) => {
          clip.error = String(err?.message || err);
          clip.status = clip.fallbackUrl ? "fallback" : "failed";
          save();
        });
    }
  }

  function wrapModulus() {
    return slots.size >= poolSize ? Math.max(1, slots.size) : poolSize;
  }

  function refreshOne(force = false) {
    if (!force && refreshMs <= 0) return { ok: false, reason: "disabled" };
    if (slots.size === 0) return { ok: false, reason: "empty" };
    if (refreshBusy) return { ok: false, reason: "busy" };
    const slot = slots.size;
    const clip = makeClip(slot, currentModel);
    slots.set(slot, clip);
    refreshBusy = true;
    lastRefreshAt = now();
    kick(clip);
    const done = Promise.all([clip._t2v, clip._fallback].filter(Boolean));
    done.finally(() => {
      refreshBusy = false;
    });
    save();
    return { ok: true, slot, id: clip.id, feedIndex: slot };
  }

  function maybeRefresh() {
    if (refreshMs <= 0) return;
    if (slots.size < poolSize) return;
    if (now() - lastRefreshAt < refreshMs) return;
    refreshOne(false);
  }

  function ensureWindow(feedIndex, modelName) {
    if (modelName) currentModel = modelName;
    const start = Math.max(0, Number(feedIndex) || 0);
    const wrap = wrapModulus();
    const out = [];
    for (let i = start; i <= start + prefetch; i++) {
      const slot = slotOf(i, wrap);
      if (!slots.has(slot)) {
        if (slot >= poolSize && slots.size < poolSize) continue;
        slots.set(slot, makeClip(slot, modelName));
        save();
      }
      const clip = slots.get(slot);
      if (!clip) continue;
      kick(clip);
      out.push(clip);
    }
    return out;
  }

  function playableOf(clip) {
    if (clip.t2vUrl) return { url: clip.t2vUrl, source: clip.model, status: "ready" };
    if (clip.fallbackUrl) return { url: clip.fallbackUrl, source: "fallback", status: "fallback" };
    return { url: null, source: null, status: clip.status };
  }

  function serialize(clip, feedIndex = clip.slot) {
    const playable = playableOf(clip);
    return {
      id: clip.id,
      index: feedIndex,
      feedIndex,
      slot: clip.slot,
      handle: clip.handle,
      caption: clip.caption,
      prompt: clip.prompt,
      model: clip.model,
      status: playable.status,
      source: playable.source,
      videoUrl: playable.url,
      posterUrl: clip.posterUrl,
      requestId: clip.requestId,
      error: clip.error,
      upgrading: Boolean(clip.t2vStarted && !clip.t2vUrl),
    };
  }

  async function getFeed(index, extra = {}) {
    const feedIndex = Math.max(0, Number(index) || 0);
    const waitFallbackMs = extra.waitFallbackMs ?? 0;
    const modelName = extra.model;
    lastFeedAt = now();
    maybeRefresh();
    const window = ensureWindow(feedIndex, modelName);
    const current = slots.get(slotOf(feedIndex, wrapModulus()));
    if (waitFallbackMs > 0 && current && !current.t2vUrl && !current.fallbackUrl && current._fallback) {
      await Promise.race([
        current._fallback,
        new Promise((resolve) => setTimeout(resolve, waitFallbackMs)),
      ]);
    }
    return {
      index: feedIndex,
      prefetch,
      poolSize,
      clips: window.map((clip, i) => serialize(clip, feedIndex + i)),
    };
  }

  function getById(id) {
    for (const clip of slots.values()) {
      if (clip.id === id) return serialize(clip, clip.slot);
    }
    return null;
  }

  function getByIndex(index) {
    const feedIndex = Math.max(0, Number(index) || 0);
    ensureWindow(feedIndex);
    return serialize(slots.get(slotOf(feedIndex, wrapModulus())), feedIndex);
  }

  function poolStatus() {
    return {
      poolSize,
      filled: slots.size,
      prefetch,
      refreshMs,
      lastRefreshAt,
      lastFeedAt,
      refreshBusy,
      slots: [...slots.values()].map((clip) => serialize(clip, clip.slot)),
    };
  }

  function ingestReadyClip(rec) {
    if (!rec) return { ok: false };
    if (rec.requestId) {
      for (const c of slots.values()) {
        if (c.requestId === rec.requestId && c.t2vUrl) {
          return { ok: true, slot: c.slot, duplicate: true };
        }
      }
    }
    let slot = rec.slot != null ? Number(rec.slot) : slots.size;
    if (!Number.isInteger(slot) || slot < 0) slot = slots.size;
    if (slots.has(slot) && slots.get(slot).t2vUrl && slots.get(slot).id !== rec.id) {
      slot = slots.size;
    }
    slots.set(slot, restoreClip({ ...rec, slot }));
    if (typeof rec.generation === "number") seq = Math.max(seq, rec.generation + 1);
    save();
    return { ok: true, slot };
  }

  return {
    prefetch,
    poolSize,
    refreshMs,
    defaultModel,
    ensureWindow,
    getFeed,
    getById,
    getByIndex,
    serialize,
    playableOf,
    refresh: () => refreshOne(true),
    ingestReadyClip,
    poolStatus,
    snapshot,
    raw: (indexOrSlot) => slots.get(slotOf(indexOrSlot, wrapModulus())),
    startCounts: counts,
  };
}
