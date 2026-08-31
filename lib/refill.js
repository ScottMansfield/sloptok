import { queueSubmit } from "./fal-queue.js";
import { getModel } from "./models.js";
import { pickPrompt } from "./prompts.js";

export function buildFalWebhookUrl({ publicUrl, token, slot, id }) {
  const base = String(publicUrl || "").replace(/\/$/, "");
  if (!base) throw new Error("SLOP_PUBLIC_URL is not set");
  const u = new URL(`${base}/internal/fal-webhook`);
  if (token) u.searchParams.set("token", token);
  if (slot != null) u.searchParams.set("slot", String(slot));
  if (id) u.searchParams.set("id", id);
  return u.toString();
}

export async function submitH3Refill(opts = {}) {
  const submit = opts.queueSubmit ?? queueSubmit;
  const modelFn = opts.getModel ?? getModel;
  const pick = opts.pickPrompt ?? pickPrompt;
  const library = opts.library || { slots: [], promptSeq: 0 };
  const slot = Array.isArray(library.slots) ? library.slots.length : 0;
  const generation = typeof library.promptSeq === "number" ? library.promptSeq : slot;
  const seed = pick(generation);
  const id = `slop-${slot}-${generation}-t2v`;
  const model = modelFn("h3");
  const webhookUrl = buildFalWebhookUrl({
    publicUrl: opts.publicUrl ?? process.env.SLOP_PUBLIC_URL,
    token: opts.webhookSecret ?? process.env.WEBHOOK_SECRET,
    slot,
    id,
  });
  const submitted = await submit(model.id, model.input(seed.prompt), {
    webhookUrl,
    fetchImpl: opts.fetchImpl,
    falKey: opts.falKey,
  });
  return {
    status: 202,
    request_id: submitted.requestId,
    requestId: submitted.requestId,
    slot,
    id,
    handle: seed.handle,
    caption: seed.caption,
    prompt: seed.prompt,
    model: "h3",
    webhookUrl,
  };
}
