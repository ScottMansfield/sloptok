import { DurableObject } from "cloudflare:workers";
import { pickPrompt } from "../../lib/prompts.js";

const DAY = 86400e3;
const PENDING_TTL = 2 * 3600e3;
const FAL_QUEUE = "https://queue.fal.run";

const extractVideoUrl = (r) => r?.video?.url || r?.data?.video?.url || r?.payload?.video?.url || null;

// Single writer for the catalog. Every mutation runs through this.lock(), so two
// webhooks arriving together can never clobber each other (the old GCS race).
export class Catalog extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.chain = Promise.resolve();
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`CREATE TABLE IF NOT EXISTS clips (slot INTEGER PRIMARY KEY, id TEXT UNIQUE, file TEXT, handle TEXT, caption TEXT, prompt TEXT, model TEXT, request_id TEXT UNIQUE, created_at INTEGER)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS pending (request_id TEXT PRIMARY KEY, slot INTEGER, id TEXT, handle TEXT, caption TEXT, prompt TEXT, submitted_at INTEGER)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS submits (at INTEGER, request_id TEXT, source TEXT)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
    });
  }

  lock(fn) {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => {});
    return run;
  }

  meta(k, d = null) { const r = this.sql.exec("SELECT v FROM meta WHERE k=?", k).toArray()[0]; return r ? JSON.parse(r.v) : d; }
  setMeta(k, v) { this.sql.exec("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, JSON.stringify(v)); }
  clips() { return this.sql.exec("SELECT * FROM clips ORDER BY slot").toArray(); }

  async state() {
    const now = Date.now();
    const c = (since) => this.sql.exec("SELECT COUNT(*) n FROM submits WHERE at>=?", since).one().n;
    return {
      clips: this.sql.exec("SELECT COUNT(*) n FROM clips").one().n,
      pending: this.sql.exec("SELECT request_id, slot, id, submitted_at FROM pending").toArray(),
      nextSlot: this.meta("nextSlot", 0),
      submits24h: c(now - DAY),
      submits30d: c(now - 30 * DAY),
      submitsTotal: c(0),
      lastIngest: this.meta("lastIngest"),
    };
  }

  // One-time import of the old GCS library.json.
  async seed(library) {
    return this.lock(async () => {
      if (this.sql.exec("SELECT COUNT(*) n FROM clips").one().n > 0) return { ok: false, reason: "already seeded" };
      let max = -1;
      for (const s of library.slots || []) {
        const file = s.t2vFile || (s.t2vUrl || "").split("/").pop();
        if (!file || s.status !== "ready") continue;
        this.sql.exec("INSERT INTO clips VALUES (?,?,?,?,?,?,?,?,?)", s.slot, s.id, file, s.handle || null, s.caption || null, s.prompt || null, s.model || "h3", s.requestId || null, s.createdAt || null);
        max = Math.max(max, s.slot);
      }
      this.setMeta("nextSlot", Math.max(library.promptSeq || 0, max + 1));
      await this.publish();
      return { ok: true, clips: this.sql.exec("SELECT COUNT(*) n FROM clips").one().n, nextSlot: this.meta("nextSlot") };
    });
  }

  // Writes feed.json (public projection) and catalog.json (full export) to R2.
  async publish() {
    const rows = this.clips();
    const feed = rows.map((r) => ({ id: r.id, file: r.file, handle: r.handle, caption: r.caption }));
    await this.env.CLIPS.put("feed.json", JSON.stringify({ updatedAt: Date.now(), cdn: this.env.CDN_BASE_URL, clips: feed }), {
      httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=60" },
    });
    await this.env.CLIPS.put("catalog/catalog.json", JSON.stringify({ exportedAt: Date.now(), nextSlot: this.meta("nextSlot"), clips: rows }, null, 1), {
      httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
    });
    return feed.length;
  }

  // Guarded submit. source "cron" also requires the kill switch; "admin" skips only the kill switch.
  async refill(source = "cron") {
    return this.lock(async () => {
      const env = this.env, now = Date.now();
      if (source === "cron" && env.REFILL_ENABLED !== "true") return { ok: false, reason: "kill switch off" };
      this.sql.exec("DELETE FROM pending WHERE submitted_at < ?", now - PENDING_TTL);
      const s = await this.state();
      if (s.pending.length >= Number(env.MAX_PENDING || 1)) return { ok: false, reason: "in-flight limit" };
      if (s.submits24h >= Number(env.DAILY_GEN_CAP || 0)) return { ok: false, reason: "daily cap" };
      if (s.submits30d >= Number(env.MONTHLY_GEN_CAP || 0)) return { ok: false, reason: "monthly cap" };
      if (!env.FAL_KEY) return { ok: false, reason: "no FAL_KEY" };

      const slot = s.nextSlot;
      const seed = pickPrompt(slot);
      const id = `slop-${slot}-${slot}-t2v`;
      const hook = `${env.PUBLIC_URL.replace(/\/$/, "")}/internal/fal-webhook`;
      const res = await fetch(`${FAL_QUEUE}/${env.FAL_MODEL}?fal_webhook=${encodeURIComponent(hook)}`, {
        method: "POST",
        headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ prompt: seed.prompt, duration: 5, resolution: "768P", aspect_ratio: "9:16", prompt_expansion_mode: "fast" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.request_id) return { ok: false, reason: `fal submit ${res.status}` };
      this.sql.exec("INSERT INTO submits VALUES (?,?,?)", now, data.request_id, source);
      this.sql.exec("INSERT INTO pending VALUES (?,?,?,?,?,?,?)", data.request_id, slot, id, seed.handle, seed.caption, seed.prompt, now);
      this.setMeta("nextSlot", slot + 1);
      return { ok: true, requestId: data.request_id, slot, id };
    });
  }

  // Called only after the Worker verified fal's signature. Idempotent on request_id.
  async ingest(payload) {
    return this.lock(async () => {
      const rid = payload.request_id;
      if (!rid) return { ok: false, reason: "no request_id" };
      if (this.sql.exec("SELECT 1 FROM clips WHERE request_id=?", rid).toArray().length) return { ok: true, duplicate: true };
      const p = this.sql.exec("SELECT * FROM pending WHERE request_id=?", rid).toArray()[0];
      if (!p) return { ok: false, reason: "unknown request_id" };
      if (payload.status && payload.status !== "OK") {
        this.sql.exec("DELETE FROM pending WHERE request_id=?", rid);
        return { ok: false, reason: `fal status ${payload.status}` };
      }
      let url = extractVideoUrl(payload.payload) || extractVideoUrl(payload);
      if (!url) {
        const r = await fetch(`${FAL_QUEUE}/${this.env.FAL_MODEL}/requests/${rid}`, { headers: { Authorization: `Key ${this.env.FAL_KEY}` } });
        url = extractVideoUrl(await r.json().catch(() => null));
      }
      if (!url) return { ok: false, reason: "no video url" };
      const vid = await fetch(url);
      if (!vid.ok) return { ok: false, reason: `download ${vid.status}` };
      const file = `${p.id}.mp4`;
      // Stream straight into R2 (no buffering: keeps CPU/memory tiny).
      await this.env.CLIPS.put(`clips/${file}`, vid.body, {
        httpMetadata: { contentType: "video/mp4", cacheControl: "public, max-age=31536000, immutable" },
      });
      this.sql.exec("INSERT INTO clips VALUES (?,?,?,?,?,?,?,?,?)", p.slot, p.id.replace(/-t2v$/, ""), file, p.handle, p.caption, p.prompt, "h3", rid, Date.now());
      this.sql.exec("DELETE FROM pending WHERE request_id=?", rid);
      this.setMeta("lastIngest", { at: Date.now(), requestId: rid, file });
      const n = await this.publish();
      return { ok: true, slot: p.slot, file, clips: n };
    });
  }
}
