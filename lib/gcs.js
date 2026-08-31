const JSON_API = "https://storage.googleapis.com/storage/v1";
const UPLOAD_API = "https://storage.googleapis.com/upload/storage/v1";
const META_TOKEN =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function metadataToken(fetchImpl) {
  const res = await fetchImpl(META_TOKEN, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!res.ok) throw new Error(`gcs metadata token ${res.status}`);
  const data = await readJson(res);
  if (!data.access_token) throw new Error("gcs metadata token missing");
  return data.access_token;
}

function objectPath(name) {
  return encodeURIComponent(name);
}

export function createGcs(opts = {}) {
  const bucket = opts.bucket ?? process.env.SLOP_BUCKET;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const getToken = opts.getToken ?? (() => metadataToken(fetchImpl));

  async function headers(extra = {}) {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  async function putObject(name, body, contentType = "application/octet-stream") {
    if (!bucket) throw new Error("SLOP_BUCKET is not set");
    const url =
      `${UPLOAD_API}/b/${encodeURIComponent(bucket)}/o` +
      `?uploadType=media&name=${objectPath(name)}`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: await headers({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      }),
      body,
    });
    if (!res.ok) {
      const data = await readJson(res);
      const detail = data.error?.message || data.raw || res.statusText;
      throw new Error(`gcs upload ${res.status}: ${detail}`);
    }
    return readJson(res);
  }

  async function getObjectBuffer(name) {
    if (!bucket) throw new Error("SLOP_BUCKET is not set");
    const url = `${JSON_API}/b/${encodeURIComponent(bucket)}/o/${objectPath(name)}?alt=media`;
    const res = await fetchImpl(url, { headers: await headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`gcs get ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async function getObjectText(name) {
    const buf = await getObjectBuffer(name);
    return buf ? buf.toString("utf8") : null;
  }

  return { bucket, putObject, getObjectText, getObjectBuffer };
}

export function createMemoryGcs() {
  const objects = new Map();
  return {
    bucket: "memory",
    objects,
    async putObject(name, body, contentType) {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
      objects.set(name, { buf, contentType: contentType || "application/octet-stream" });
      return { name };
    },
    async getObjectBuffer(name) {
      const hit = objects.get(name);
      return hit ? hit.buf : null;
    },
    async getObjectText(name) {
      const hit = objects.get(name);
      return hit ? hit.buf.toString("utf8") : null;
    },
  };
}
