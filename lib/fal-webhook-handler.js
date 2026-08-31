import { extractVideoUrl, queueResult } from "./fal-queue.js";
import { appendLibraryRecord, clipPublicUrl, saveLibrary } from "./library.js";

function videoFromPayload(payload) {
  if (!payload) return null;
  return (
    extractVideoUrl(payload.payload) ||
    extractVideoUrl(payload) ||
    extractVideoUrl(payload.payload?.data)
  );
}

export async function handleFalWebhook(opts = {}) {
  const payload = opts.payload || {};
  if (payload.status && payload.status !== "OK") {
    return { status: 200, ignored: true, reason: payload.status };
  }

  let videoUrl = videoFromPayload(payload);
  const requestId = payload.request_id || payload.requestId;
  if (!videoUrl && requestId && opts.queueResult) {
    const result = await opts.queueResult("minimax/h3/text-to-video", requestId, {
      fetchImpl: opts.fetchImpl,
      falKey: opts.falKey,
    });
    videoUrl = extractVideoUrl(result);
  } else if (!videoUrl && requestId && opts.fetchResult) {
    const result = await opts.fetchResult(requestId);
    videoUrl = extractVideoUrl(result);
  } else if (!videoUrl && requestId && opts.falKey) {
    const result = await queueResult("minimax/h3/text-to-video", requestId, {
      fetchImpl: opts.fetchImpl,
      falKey: opts.falKey,
    });
    videoUrl = extractVideoUrl(result);
  }
  if (!videoUrl) {
    return { status: 200, ignored: true, reason: "no-video" };
  }

  const library = opts.library || { slots: [] };
  const slot = opts.slot != null ? Number(opts.slot) : library.slots.length;
  const id = opts.id || `slop-${slot}-${requestId || "clip"}-t2v`;
  const file = id.endsWith(".mp4") ? id : `${id}.mp4`;

  const download = opts.download ?? (async (url) => {
    const res = await (opts.fetchImpl ?? fetch)(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  const buf = await download(videoUrl);
  const gcs = opts.gcs;
  if (!gcs) throw new Error("gcs client required");
  await gcs.putObject(`clips/${file}`, buf, "video/mp4");

  const record = {
    slot,
    id: id.replace(/\.mp4$/, ""),
    requestId,
    t2vFile: file,
    t2vUrl: clipPublicUrl(file, { CDN_BASE_URL: opts.cdnBaseUrl ?? process.env.CDN_BASE_URL }),
    status: "ready",
    model: "h3",
    createdAt: opts.now ?? Date.now(),
    handle: opts.handle,
    caption: opts.caption,
    prompt: opts.prompt,
  };
  const result = appendLibraryRecord(library, record);
  if (result.appended) {
    await saveLibrary(gcs, result.library);
  }
  return {
    status: 200,
    slot: result.slot,
    id: record.id,
    file,
    appended: result.appended,
    record,
    library: result.library,
  };
}
