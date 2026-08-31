import { createGcs } from "../../../lib/gcs.js";
import { handleFalWebhook } from "../../../lib/fal-webhook-handler.js";
import { loadLibrary } from "../../../lib/library.js";
import { verifyFalWebhookSignature } from "../../../lib/fal-webhook-verify.js";
import { getMachine } from "../../../lib/store.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const secret = process.env.WEBHOOK_SECRET || "";
  const raw = Buffer.from(await req.arrayBuffer());

  let authorized = Boolean(secret && token && token === secret);
  if (!authorized) {
    try {
      authorized = await verifyFalWebhookSignature(req.headers, raw);
    } catch {
      authorized = false;
    }
  }
  if (!authorized && secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload = {};
  try {
    payload = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const gcs = process.env.SLOP_BUCKET ? createGcs() : null;
  if (!gcs) {
    return Response.json({ error: "SLOP_BUCKET is not set" }, { status: 500 });
  }
  const library = await loadLibrary(gcs);
  const requestId = payload.request_id || payload.requestId;
  const pending = library.pending?.[requestId] || {};

  const result = await handleFalWebhook({
    payload,
    gcs,
    library,
    slot: url.searchParams.get("slot") ?? pending.slot,
    id: url.searchParams.get("id") || pending.id,
    handle: pending.handle,
    caption: pending.caption,
    prompt: pending.prompt,
    cdnBaseUrl: process.env.CDN_BASE_URL,
  });

  if (result.appended && result.record) {
    try {
      const machine = await getMachine();
      machine.ingestReadyClip?.(result.record);
    } catch {
      /* in-memory machine is best-effort */
    }
  }

  return Response.json(
    {
      ok: true,
      slot: result.slot,
      id: result.id,
      appended: result.appended,
      ignored: result.ignored || false,
    },
    { status: 200 },
  );
}
