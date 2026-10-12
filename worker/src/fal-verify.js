// fal webhook signature: ED25519 over "requestId\nuserId\ntimestamp\nsha256hex(body)", keys from fal JWKS.
const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const MAX_SKEW_SEC = 300;
let jwks = null, jwksAt = 0;

async function keys() {
  if (jwks && Date.now() - jwksAt < 86400e3) return jwks;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error(`jwks ${r.status}`);
  jwks = (await r.json()).keys || [];
  jwksAt = Date.now();
  return jwks;
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => {
  if (!/^[0-9a-f]+$/i.test(s) || s.length % 2) return null;
  return Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));
};
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export async function verifyFalSignature(headers, bodyBuf, nowMs = Date.now()) {
  const rid = headers.get("x-fal-webhook-request-id");
  const uid = headers.get("x-fal-webhook-user-id");
  const ts = headers.get("x-fal-webhook-timestamp");
  const sigHex = headers.get("x-fal-webhook-signature");
  if (!rid || !uid || !ts || !sigHex) return { ok: false, reason: "missing headers" };
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Math.floor(nowMs / 1000) - t) > MAX_SKEW_SEC) return { ok: false, reason: "stale timestamp" };
  const sig = unhex(sigHex);
  if (!sig) return { ok: false, reason: "bad signature hex" };
  const digest = hex(await crypto.subtle.digest("SHA-256", bodyBuf));
  const msg = new TextEncoder().encode([rid, uid, ts, digest].join("\n"));
  for (const k of await keys()) {
    if (typeof k.x !== "string") continue;
    try {
      const key = await crypto.subtle.importKey("raw", b64url(k.x), { name: "Ed25519" }, false, ["verify"]);
      if (await crypto.subtle.verify({ name: "Ed25519" }, key, sig, msg)) return { ok: true, requestId: rid };
    } catch { /* try next key */ }
  }
  return { ok: false, reason: "no key verified" };
}
