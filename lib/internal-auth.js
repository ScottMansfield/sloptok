function bearerToken(req) {
  const raw = req.headers?.get?.("authorization") || req.headers?.get?.("Authorization") || "";
  const m = String(raw).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function headerSecret(req) {
  return (
    req.headers?.get?.("x-slop-secret") ||
    req.headers?.get?.("X-Slop-Secret") ||
    bearerToken(req)
  );
}

function decodeJwtPayload(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function verifyGoogleOidc(token, audience, fetchImpl = fetch) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
  const res = await fetchImpl(url);
  if (!res.ok) return false;
  const data = await res.json();
  if (!data || data.aud !== audience) return false;
  const iss = data.iss || "";
  return iss === "https://accounts.google.com" || iss === "accounts.google.com";
}

export async function authorizeInternal(req, deps = {}) {
  const secret = deps.webhookSecret ?? process.env.WEBHOOK_SECRET;
  const provided = headerSecret(req);
  if (secret && provided && provided === secret) {
    return { ok: true, via: "secret" };
  }
  const token = bearerToken(req);
  const audience = deps.audience ?? process.env.SLOP_PUBLIC_URL;
  if (token && token.split(".").length === 3 && audience) {
    const verify = deps.verifyOidc ?? verifyGoogleOidc;
    try {
      const ok = await verify(token, audience, deps.fetchImpl ?? fetch);
      if (ok) return { ok: true, via: "oidc" };
    } catch {
      /* fall through */
    }
  }
  if (!secret && (deps.allowDev || process.env.NODE_ENV !== "production")) {
    return { ok: true, via: "dev" };
  }
  return { ok: false, via: null };
}
