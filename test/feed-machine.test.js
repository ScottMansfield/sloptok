import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFeedMachine, PREFETCH } from "../lib/feed-machine.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakePrompt(index) {
  return {
    handle: `@seed${index}`,
    caption: `caption ${index}`,
    prompt: `prompt ${index}`,
  };
}

function machineWith(overrides = {}) {
  const t2v = new Map();
  const fallback = new Map();
  const m = createFeedMachine({
    prefetch: PREFETCH,
    defaultModel: "h3",
    pickPrompt: fakePrompt,
    startT2V: async (clip) => {
      const d = deferred();
      t2v.set(clip.index, d);
      return d.promise;
    },
    startFallback: async (clip) => {
      const d = deferred();
      fallback.set(clip.index, d);
      return d.promise;
    },
    pollT2V: async (clip) => {
      const d = t2v.get(clip.index);
      return d.promise;
    },
    ...overrides,
  });
  return { m, t2v, fallback };
}

describe("feed machine prefetch / fallback", () => {
  it("prefetches two clips ahead of the current index", async () => {
    const { m } = machineWith();
    const feed = await m.getFeed(0);
    assert.equal(feed.clips.length, 3);
    assert.deepEqual(
      feed.clips.map((c) => c.index),
      [0, 1, 2],
    );
    assert.equal(m.startCounts.t2v.get(0), 1);
    assert.equal(m.startCounts.t2v.get(1), 1);
    assert.equal(m.startCounts.t2v.get(2), 1);
    assert.equal(m.startCounts.fallback.get(0), 1);
  });

  it("does not block getFeed on text-to-video", async () => {
    const { m } = machineWith();
    const started = Date.now();
    const feed = await m.getFeed(0);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 50, `getFeed waited ${elapsed}ms on t2v`);
    assert.equal(feed.clips[0].videoUrl, null);
    assert.equal(feed.clips[0].upgrading, true);
    assert.ok(["pending", "generating"].includes(feed.clips[0].status));
  });

  it("serves fallback while t2v is still cooking", async () => {
    const { m, t2v, fallback } = machineWith();
    await m.getFeed(0);
    fallback.get(0).resolve({ videoUrl: "/api/media/slop-0.mp4", posterUrl: "/api/media/slop-0.jpg" });
    const feed = await m.getFeed(0, { waitFallbackMs: 200 });
    assert.equal(feed.clips[0].source, "fallback");
    assert.equal(feed.clips[0].status, "fallback");
    assert.equal(feed.clips[0].videoUrl, "/api/media/slop-0.mp4");
    assert.equal(feed.clips[0].upgrading, true);
    assert.equal(t2v.has(0), true);
  });

  it("upgrades to t2v when the queue job completes", async () => {
    const { m, t2v, fallback } = machineWith();
    await m.getFeed(0);
    fallback.get(0).resolve({ videoUrl: "/fallback.mp4" });
    await m.getFeed(0, { waitFallbackMs: 50 });
    t2v.get(0).resolve({ requestId: "req-0", videoUrl: "https://cdn.example/h3.mp4" });
    await m.raw(0)._t2v;
    const clip = m.getByIndex(0);
    assert.equal(clip.status, "ready");
    assert.equal(clip.source, "h3");
    assert.equal(clip.videoUrl, "https://cdn.example/h3.mp4");
    assert.equal(clip.upgrading, false);
  });

  it("keeps fallback if t2v fails", async () => {
    const { m, t2v, fallback } = machineWith();
    await m.getFeed(0);
    fallback.get(0).resolve({ videoUrl: "/fallback.mp4" });
    await m.getFeed(0, { waitFallbackMs: 50 });
    t2v.get(0).reject(new Error("boom"));
    await m.raw(0)._t2v;
    const clip = m.getByIndex(0);
    assert.equal(clip.status, "fallback");
    assert.equal(clip.videoUrl, "/fallback.mp4");
    assert.equal(clip.source, "fallback");
    assert.match(clip.error, /boom/);
  });

  it("does not double-submit the same index", async () => {
    const { m } = machineWith();
    await m.getFeed(0);
    await m.getFeed(0);
    await m.getFeed(1);
    assert.equal(m.startCounts.t2v.get(0), 1);
    assert.equal(m.startCounts.fallback.get(0), 1);
    assert.equal(m.startCounts.t2v.get(1), 1);
    assert.equal(m.startCounts.t2v.get(3), 1);
  });

  it("extends the window when scrolling without waiting on earlier t2v", async () => {
    const { m } = machineWith();
    await m.getFeed(0);
    const feed = await m.getFeed(5);
    assert.deepEqual(
      feed.clips.map((c) => c.index),
      [5, 6, 7],
    );
    assert.equal(feed.clips.every((c) => c.upgrading), true);
  });

  it("uses default h3 model, not ltx", async () => {
    const { m } = machineWith();
    const feed = await m.getFeed(0);
    assert.equal(m.defaultModel, "h3");
    assert.equal(feed.clips[0].model, "h3");
  });
});
