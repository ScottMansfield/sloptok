import { createHash, createPublicKey, verify } from "node:crypto";

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const MAX_SKEW_SEC = 300;

let jwksCache = null;
let jwksCacheAt = 0;

export async function fetchJwks(fetchImpl = fetch) {
  const now = Date.now();
  if (jwksCache && now - jwksCacheAt < 24 * 60 * 60 * 1000) return jwksCache;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const data = await res.json();
  jwksCache = data.keys || [];
  jwksCacheAt = now;
  return jwksCache;
}

function ed25519Key(raw) {
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({
    key: Buffer.concat([prefix, raw]),
    format: "der",
    type: "spki",
  });
}

export async function verifyFalWebhookSignature(headers, body, deps = {}) {
  const requestId = headers.get?.("x-fal-webhook-request-id") || headers["x-fal-webhook-request-id"];
  const userId = headers.get?.("x-fal-webhook-user-id") || headers["x-fal-webhook-user-id"];
  const timestamp = headers.get?.("x-fal-webhook-timestamp") || headers["x-fal-webhook-timestamp"];
  const signatureHex = headers.get?.("x-fal-webhook-signature") || headers["x-fal-webhook-signature"];
  if (!requestId || !userId || !timestamp || !signatureHex) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor((deps.now ?? Date.now)() / 1000);
  if (Math.abs(nowSec - ts) > MAX_SKEW_SEC) return false;
  const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const digest = createHash("sha256").update(bodyBuf).digest("hex");
  const message = Buffer.from([requestId, userId, timestamp, digest].join("\n"), "utf8");
  let signature;
  try {
    signature = Buffer.from(String(signatureHex), "hex");
  } catch {
    return false;
  }
  const keys = deps.keys ?? (await fetchJwks(deps.fetchImpl ?? fetch));
  for (const key of keys) {
    try {
      if (typeof key.x !== "string") continue;
      const raw = Buffer.from(key.x, "base64url");
      const pub = ed25519Key(raw);
      if (verify(null, message, pub, signature)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function resetJwksCache() {
  jwksCache = null;
  jwksCacheAt = 0;
}
