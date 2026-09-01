import { authorizeInternal } from "../../../lib/internal-auth.js";
import { createGcs } from "../../../lib/gcs.js";
import { loadLibrary, saveLibrary } from "../../../lib/library.js";
import { submitH3Refill } from "../../../lib/refill.js";
import { getMachine } from "../../../lib/store.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  const auth = await authorizeInternal(req);
  if (!auth.ok) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const gcs = process.env.SLOP_BUCKET ? createGcs() : null;
  const library = gcs
    ? await loadLibrary(gcs)
    : { slots: (await getMachine()).snapshot().slots, promptSeq: 0 };

  const result = await submitH3Refill({
    library,
    publicUrl: process.env.SLOP_PUBLIC_URL,
    webhookSecret: process.env.WEBHOOK_SECRET,
  });

  if (gcs) {
    const pending = {
      ...library,
      promptSeq: Math.max(library.promptSeq || 0, result.slot + 1),
      pending: {
        ...(library.pending || {}),
        [result.request_id]: {
          slot: result.slot,
          id: result.id,
          handle: result.handle,
          caption: result.caption,
          prompt: result.prompt,
          requestId: result.request_id,
        },
      },
    };
    await saveLibrary(gcs, pending).catch(() => {});
  }

  return Response.json(
    {
      ok: true,
      request_id: result.request_id,
      slot: result.slot,
      id: result.id,
    },
    { status: 202 },
  );
}
