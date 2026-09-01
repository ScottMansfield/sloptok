import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { queueSubmit } from "../lib/fal-queue.js";
import { submitH3Refill, buildFalWebhookUrl } from "../lib/refill.js";
import { handleFalWebhook } from "../lib/fal-webhook-handler.js";
import { appendLibraryRecord, emptyLibrary, clipPublicUrl } from "../lib/library.js";
import { createMemoryGcs } from "../lib/gcs.js";
import { createFeedMachine } from "../lib/feed-machine.js";

function jsonRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "X",
    async text() {
      return JSON.stringify(body);
    },
    async arrayBuffer() {
      return Buffer.from(JSON.stringify(body));
    },
  };
}

function fakePrompt(index) {
  return {
    handle: `@seed${index}`,
    caption: `caption ${index}`,
    prompt: `prompt ${index}`,
  };
}

describe("production refill does not poll", () => {
  it("queueSubmit with webhookUrl hits fal_webhook and never /status", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), method: init.method });
      return jsonRes(200, { request_id: "abc", status: "IN_QUEUE" });
    };
    const out = await queueSubmit(
      "minimax/h3/text-to-video",
      { prompt: "hi" },
      {
        fetchImpl,
        falKey: "test-key",
        webhookUrl: "https://slop.example/internal/fal-webhook?token=t",
      },
    );
    assert.equal(out.requestId, "abc");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /fal_webhook=/);
    assert.match(calls[0].url, /queue\.fal\.run\/minimax\/h3\/text-to-video/);
    assert.ok(!calls.some((c) => c.url.includes("/status")));
  });

  it("submitH3Refill returns 202 request_id and does not call pollUntilDone", async () => {
    const calls = [];
    let pollCalled = false;
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), method: init.method, body: init.body });
      return jsonRes(200, { request_id: "req-9" });
    };
    const result = await submitH3Refill({
      fetchImpl,
      falKey: "test-key",
      publicUrl: "https://slop.example",
      webhookSecret: "shh",
      library: { slots: [{ slot: 0 }], promptSeq: 1 },
      pickPrompt: fakePrompt,
      pollUntilDone: async () => {
        pollCalled = true;
        throw new Error("must not poll");
      },
    });
    assert.equal(result.status, 202);
    assert.equal(result.request_id, "req-9");
    assert.equal(result.slot, 1);
    assert.equal(pollCalled, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.ok(!calls.some((c) => String(c.url).includes("/status")));
    const posted = new URL(calls[0].url);
    assert.equal(posted.searchParams.get("fal_webhook"), result.webhookUrl);
    assert.match(result.webhookUrl, /\/internal\/fal-webhook/);
    assert.match(result.webhookUrl, /token=shh/);
  });
});

describe("webhook appends library", () => {
  it("downloads mp4, uploads clips/{id}.mp4, appends library.json", async () => {
    const gcs = createMemoryGcs();
    const downloads = [];
    const library = emptyLibrary(20);
    const result = await handleFalWebhook({
      payload: {
        request_id: "rid-1",
        status: "OK",
        payload: { video: { url: "https://fal.example/out.mp4" } },
      },
      gcs,
      library,
      slot: 0,
      id: "slop-0-0-t2v",
      cdnBaseUrl: "https://cdn.example",
      download: async (url) => {
        downloads.push(url);
        return Buffer.from("mp4-bytes");
      },
      now: 1700000000000,
    });
    assert.equal(result.status, 200);
    assert.equal(result.appended, true);
    assert.equal(result.file, "slop-0-0-t2v.mp4");
    assert.equal(gcs.objects.get("clips/slop-0-0-t2v.mp4").buf.toString(), "mp4-bytes");
    const stored = JSON.parse(await gcs.getObjectText("library.json"));
    assert.equal(stored.slots.length, 1);
    assert.equal(stored.slots[0].t2vUrl, "https://cdn.example/clips/slop-0-0-t2v.mp4");
    assert.equal(stored.slots[0].requestId, "rid-1");
    assert.deepEqual(downloads, ["https://fal.example/out.mp4"]);
  });

  it("is idempotent on request_id and never deletes prior clips", async () => {
    let library = emptyLibrary();
    const first = appendLibraryRecord(library, {
      slot: 0,
      id: "slop-0-0-t2v",
      requestId: "rid-1",
      t2vFile: "slop-0-0-t2v.mp4",
    });
    assert.equal(first.appended, true);
    const dup = appendLibraryRecord(first.library, {
      slot: 1,
      id: "slop-1-1-t2v",
      requestId: "rid-1",
      t2vFile: "other.mp4",
    });
    assert.equal(dup.appended, false);
    assert.equal(dup.library.slots.length, 1);
    const second = appendLibraryRecord(first.library, {
      slot: 1,
      id: "slop-1-1-t2v",
      requestId: "rid-2",
      t2vFile: "slop-1-1-t2v.mp4",
    });
    assert.equal(second.appended, true);
    assert.equal(second.library.slots.length, 2);
    assert.equal(second.library.slots[0].id, "slop-0-0-t2v");
  });

  it("clipPublicUrl uses CDN in production and /api/media locally", () => {
    assert.equal(
      clipPublicUrl("slop-0-0-t2v.mp4", { CDN_BASE_URL: "https://cdn.example" }),
      "https://cdn.example/clips/slop-0-0-t2v.mp4",
    );
    assert.equal(clipPublicUrl("slop-0-0-t2v.mp4", {}), "/api/media/slop-0-0-t2v.mp4");
  });

  it("ERROR status returns 200 without appending", async () => {
    const gcs = createMemoryGcs();
    const result = await handleFalWebhook({
      payload: { request_id: "x", status: "ERROR", error: "nope" },
      gcs,
      library: emptyLibrary(),
    });
    assert.equal(result.status, 200);
    assert.equal(result.ignored, true);
    assert.equal(gcs.objects.size, 0);
  });
});

describe("wrap/append still works", () => {
  it("ingestReadyClip appends and wrap uses grown library", async () => {
    const m = createFeedMachine({
      poolSize: 4,
      refreshMs: 0,
      pickPrompt: fakePrompt,
    });
    for (let slot = 0; slot < 4; slot++) {
      m.ingestReadyClip({
        slot,
        id: `slop-${slot}-ready`,
        t2vUrl: `https://cdn.example/clips/slop-${slot}-t2v.mp4`,
        t2vFile: `slop-${slot}-t2v.mp4`,
        handle: `@h${slot}`,
        caption: `c${slot}`,
        prompt: `p${slot}`,
        model: "h3",
      });
    }
    const ids = [0, 1, 2, 3].map((s) => m.raw(s).id);
    const added = m.ingestReadyClip({
      slot: 4,
      id: "slop-4-new",
      t2vUrl: "https://cdn.example/clips/slop-4-t2v.mp4",
      t2vFile: "slop-4-t2v.mp4",
      model: "h3",
    });
    assert.equal(added.ok, true);
    assert.deepEqual(
      [0, 1, 2, 3].map((s) => m.raw(s).id),
      ids,
    );
    assert.equal(m.poolStatus().filled, 5);
    const wrapped = await m.getFeed(5);
    assert.equal(wrapped.clips[0].slot, 0);
    assert.equal(wrapped.clips[0].id, "slop-0-ready");
    const atFour = await m.getFeed(4);
    assert.equal(atFour.clips[0].slot, 4);
    assert.equal(atFour.clips[0].videoUrl, "https://cdn.example/clips/slop-4-t2v.mp4");
  });
});


describe("internal refill route", () => {
  it("POST returns 202 after a single fal submit", async () => {
    const { POST } = await import("../app/api/internal/refill/route.js");
    const prev = {
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      SLOP_PUBLIC_URL: process.env.SLOP_PUBLIC_URL,
      FAL_KEY: process.env.FAL_KEY,
      SLOP_BUCKET: process.env.SLOP_BUCKET,
      K_SERVICE: process.env.K_SERVICE,
    };
    process.env.WEBHOOK_SECRET = "s3cret";
    process.env.SLOP_PUBLIC_URL = "https://run.example";
    process.env.FAL_KEY = "test-key";
    delete process.env.SLOP_BUCKET;
    delete process.env.K_SERVICE;
    const urls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      urls.push(String(url));
      assert.equal(init.method, "POST");
      assert.ok(String(url).includes("fal_webhook"));
      assert.ok(!String(url).includes("/status"));
      return jsonRes(200, { request_id: "abc-202", status: "IN_QUEUE" });
    };
    try {
      const res = await POST(
        new Request("https://run.example/internal/refill", {
          method: "POST",
          headers: { authorization: "Bearer s3cret" },
        }),
      );
      assert.equal(res.status, 202);
      const body = await res.json();
      assert.equal(body.request_id, "abc-202");
      assert.equal(urls.length, 1);
    } finally {
      globalThis.fetch = origFetch;
      for (const [k, v] of Object.entries(prev)) {
        if (v == null) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe("refill slot allocation", () => {
  it("counts pending slots so a second submit does not reuse the in-flight id", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      async text() {
        return JSON.stringify({ request_id: "req-next" });
      },
    });
    const result = await submitH3Refill({
      fetchImpl,
      falKey: "test-key",
      publicUrl: "https://slop.example",
      webhookSecret: "shh",
      library: {
        slots: [{ slot: 0 }, { slot: 1 }],
        promptSeq: 2,
        pending: { "req-old": { slot: 2, id: "slop-2-2-t2v" } },
      },
      pickPrompt: fakePrompt,
    });
    assert.equal(result.slot, 3);
    assert.equal(result.id, "slop-3-3-t2v");
  });
});
