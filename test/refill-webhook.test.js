import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { queueSubmit } from "../lib/fal-queue.js";
import { submitH3Refill } from "../lib/refill.js";
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
  };
}

function fakePrompt(index) {
  return { handle: `@seed${index}`, caption: `caption ${index}`, prompt: `prompt ${index}` };
}

describe("production refill does not poll", () => {
  it("queueSubmit with webhookUrl hits fal_webhook and never /status", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), method: init.method });
      return jsonRes(200, { request_id: "abc", status: "IN_QUEUE" });
    };
    const out = await queueSubmit("minimax/h3/text-to-video", { prompt: "hi" }, {
      fetchImpl,
      falKey: "test-key",
      webhookUrl: "https://slop.example/internal/fal-webhook?token=t",
    });
    assert.equal(out.requestId, "abc");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /fal_webhook=/);
    assert.ok(!calls.some((c) => c.url.includes("/status")));
  });

  it("submitH3Refill returns 202 request_id and does not call pollUntilDone", async () => {
    const calls = [];
    let pollCalled = false;
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), method: init.method });
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
    assert.ok(!calls.some((c) => String(c.url).includes("/status")));
  });
});

describe("webhook appends library", () => {
  it("downloads mp4, uploads clips/{id}.mp4, appends library.json", async () => {
    const gcs = createMemoryGcs();
    const result = await handleFalWebhook({
      payload: {
        request_id: "rid-1",
        status: "OK",
        payload: { video: { url: "https://fal.example/out.mp4" } },
      },
      gcs,
      library: emptyLibrary(20),
      slot: 0,
      id: "slop-0-0-t2v",
      cdnBaseUrl: "https://cdn.example",
      download: async () => Buffer.from("mp4-bytes"),
      now: 1700000000000,
    });
    assert.equal(result.status, 200);
    assert.equal(result.appended, true);
    assert.equal(gcs.objects.get("clips/slop-0-0-t2v.mp4").buf.toString(), "mp4-bytes");
    const stored = JSON.parse(await gcs.getObjectText("library.json"));
    assert.equal(stored.slots.length, 1);
    assert.equal(stored.slots[0].t2vUrl, "https://cdn.example/clips/slop-0-0-t2v.mp4");
  });

  it("is idempotent on request_id and never deletes prior clips", () => {
    const first = appendLibraryRecord(emptyLibrary(), {
      slot: 0,
      id: "slop-0-0-t2v",
      requestId: "rid-1",
      t2vFile: "slop-0-0-t2v.mp4",
    });
    const dup = appendLibraryRecord(first.library, {
      slot: 1,
      id: "other",
      requestId: "rid-1",
    });
    assert.equal(dup.appended, false);
    assert.equal(dup.library.slots.length, 1);
    const second = appendLibraryRecord(first.library, {
      slot: 1,
      id: "slop-1-1-t2v",
      requestId: "rid-2",
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
});

describe("wrap/append still works", () => {
  it("ingestReadyClip appends and wrap uses grown library", async () => {
    const m = createFeedMachine({ poolSize: 4, refreshMs: 0, pickPrompt: fakePrompt });
    for (let slot = 0; slot < 4; slot++) {
      m.ingestReadyClip({
        slot,
        id: `slop-${slot}-ready`,
        t2vUrl: `https://cdn.example/clips/slop-${slot}-t2v.mp4`,
        t2vFile: `slop-${slot}-t2v.mp4`,
        model: "h3",
      });
    }
    const ids = [0, 1, 2, 3].map((s) => m.raw(s).id);
    m.ingestReadyClip({
      slot: 4,
      id: "slop-4-new",
      t2vUrl: "https://cdn.example/clips/slop-4-t2v.mp4",
      model: "h3",
    });
    assert.deepEqual([0, 1, 2, 3].map((s) => m.raw(s).id), ids);
    assert.equal(m.poolStatus().filled, 5);
    const wrapped = await m.getFeed(5);
    assert.equal(wrapped.clips[0].slot, 0);
    const atFour = await m.getFeed(4);
    assert.equal(atFour.clips[0].slot, 4);
  });
});
