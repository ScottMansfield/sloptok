import { verifyFalSignature } from "./fal-verify.js";
export { Catalog } from "./catalog.js";

const json = (d, status = 200, h = {}) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...h } });
const catalog = (env) => env.CATALOG.get(env.CATALOG.idFromName("catalog"));

function isAdmin(req, env) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m || !env.ADMIN_TOKEN) return false;
  const a = new TextEncoder().encode(m[1]), b = new TextEncoder().encode(env.ADMIN_TOKEN);
  return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.hostname === "www.sloptok.dev") {
      url.hostname = "sloptok.dev";
      return Response.redirect(url.toString(), 301);
    }
    const p = url.pathname;

    if (p === "/feed.json" || p === "/api/feed") {
      const obj = await env.CLIPS.get("feed.json");
      if (!obj) return json({ error: "no feed" }, 503);
      return new Response(obj.body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
    }
    if (p === "/api/health") {
      const s = await catalog(env).state();
      return json({ ok: s.clips > 0, filled: s.clips, pending: s.pending.length, refillEnabled: env.REFILL_ENABLED === "true" });
    }

    if (p === "/internal/fal-webhook" && req.method === "POST") {
      const body = await req.arrayBuffer();
      const v = await verifyFalSignature(req.headers, body);
      if (!v.ok) return json({ error: "unauthorized", reason: v.reason }, 401);
      let payload;
      try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return json({ error: "bad json" }, 400); }
      if (payload.request_id && payload.request_id !== v.requestId) return json({ error: "request id mismatch" }, 401);
      // Keep the raw signed delivery for debugging/replay tests (no secrets in it).
      ctx.waitUntil(env.CLIPS.put(`catalog/webhooks/${v.requestId}.json`, JSON.stringify({
        receivedAt: Date.now(),
        headers: Object.fromEntries([...req.headers].filter(([k]) => k.startsWith("x-fal-webhook-"))),
        body: new TextDecoder().decode(body),
      })));
      return json(await catalog(env).ingest(payload));
    }

    if (p.startsWith("/internal/admin/")) {
      if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
      const op = p.slice("/internal/admin/".length);
      if (op === "state") return json(await catalog(env).state());
      if (op === "seed" && req.method === "POST") return json(await catalog(env).seed(await req.json()));
      if (op === "refill-once" && req.method === "POST") return json(await catalog(env).refill("admin"));
      if (op === "publish" && req.method === "POST") return json({ clips: await catalog(env).publish() });
      return json({ error: "unknown op" }, 404);
    }
    if (p.startsWith("/internal/") || p.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(req);
  },

  async scheduled(event, env, ctx) {
    if (env.REFILL_ENABLED !== "true") return; // kill switch, checked again inside the DO
    ctx.waitUntil(catalog(env).refill("cron"));
  },
};
