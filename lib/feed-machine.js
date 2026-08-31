export const PREFETCH = 2;

export function createFeedMachine(opts = {}) {
  const prefetch = opts.prefetch ?? PREFETCH;
  const defaultModel = opts.defaultModel ?? "h3";
  const pickPrompt = opts.pickPrompt;
  if (typeof pickPrompt !== "function") {
    throw new Error("pickPrompt required");
  }
  const startT2V = opts.startT2V;
  const startFallback = opts.startFallback;
  const pollT2V = opts.pollT2V;
  const now = opts.now ?? Date.now;

  const clips = new Map();
  const counts = { t2v: new Map(), fallback: new Map() };

  function bump(map, index) {
    map.set(index, (map.get(index) || 0) + 1);
  }

  function makeClip(index, modelName) {
    const seed = pickPrompt(index);
    return {
      id: `slop-${index}`,
      index,
      handle: seed.handle,
      caption: seed.caption,
      prompt: seed.prompt,
      model: modelName || defaultModel,
      status: "pending",
      requestId: null,
      t2vUrl: null,
      fallbackUrl: null,
      posterUrl: null,
      startedAt: now(),
      t2vStarted: false,
      fallbackStarted: false,
      error: null,
      fallbackError: null,
    };
  }

  function kick(clip) {
    if (startFallback && !clip.fallbackStarted) {
      clip.fallbackStarted = true;
      bump(counts.fallback, clip.index);
      clip._fallback = Promise.resolve()
        .then(() => startFallback(clip))
        .then((res) => {
          if (res?.videoUrl) clip.fallbackUrl = res.videoUrl;
          if (res?.posterUrl) clip.posterUrl = res.posterUrl;
          if (!clip.t2vUrl) clip.status = clip.fallbackUrl ? "fallback" : clip.status;
          return res;
        })
        .catch((err) => {
          clip.fallbackError = String(err?.message || err);
        });
    }

    if (startT2V && !clip.t2vStarted) {
      clip.t2vStarted = true;
      bump(counts.t2v, clip.index);
      if (!clip.fallbackUrl) clip.status = "generating";
      clip._t2v = Promise.resolve()
        .then(() => startT2V(clip))
        .then(async (res) => {
          if (res?.requestId) clip.requestId = res.requestId;
          if (!pollT2V) return res;
          const result = await pollT2V(clip);
          if (result?.videoUrl) {
            clip.t2vUrl = result.videoUrl;
            clip.status = "ready";
            return result;
          }
          clip.error = result?.error || "t2v incomplete";
          if (!clip.fallbackUrl) clip.status = "failed";
          else clip.status = "fallback";
          return result;
        })
        .catch((err) => {
          clip.error = String(err?.message || err);
          clip.status = clip.fallbackUrl ? "fallback" : "failed";
        });
    }
  }

  function ensureWindow(index, modelName) {
    const start = Math.max(0, Number(index) || 0);
    const out = [];
    for (let i = start; i <= start + prefetch; i++) {
      if (!clips.has(i)) {
        clips.set(i, makeClip(i, modelName));
      }
      const clip = clips.get(i);
      kick(clip);
      out.push(clip);
    }
    return out;
  }

  function playableOf(clip) {
    if (clip.t2vUrl) {
      return { url: clip.t2vUrl, source: clip.model, status: "ready" };
    }
    if (clip.fallbackUrl) {
      return { url: clip.fallbackUrl, source: "fallback", status: "fallback" };
    }
    return { url: null, source: null, status: clip.status };
  }

  function serialize(clip) {
    const playable = playableOf(clip);
    return {
      id: clip.id,
      index: clip.index,
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
    const waitFallbackMs = extra.waitFallbackMs ?? 0;
    const modelName = extra.model;
    const window = ensureWindow(index, modelName);
    const current = clips.get(index);
    if (
      waitFallbackMs > 0 &&
      current &&
      !current.t2vUrl &&
      !current.fallbackUrl &&
      current._fallback
    ) {
      await Promise.race([
        current._fallback,
        new Promise((resolve) => setTimeout(resolve, waitFallbackMs)),
      ]);
    }
    return { index, prefetch, clips: window.map(serialize) };
  }

  function getById(id) {
    for (const clip of clips.values()) {
      if (clip.id === id) return serialize(clip);
    }
    return null;
  }

  function getByIndex(index) {
    ensureWindow(index);
    return serialize(clips.get(index));
  }

  return {
    prefetch,
    defaultModel,
    ensureWindow,
    getFeed,
    getById,
    getByIndex,
    serialize,
    playableOf,
    raw: (index) => clips.get(index),
    startCounts: counts,
  };
}
