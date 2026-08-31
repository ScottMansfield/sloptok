import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFeedMachine, PREFETCH, POOL_SIZE } from "../lib/feed-machine.js";

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
      t2v.set(clip.slot, d);
      return d.promise;
    },
    startFallback: async (clip) => {
      const d = deferred();
      fallback.set(clip.slot, d);
      return d.promise;
    },
    pollT2V: async (clip) => {
      const d = t2v.get(clip.slot);
      return d.promise;
    },
    refreshMs: 0,
    ...overrides,
  });
  return { m, t2v, fallback };
}

async function fillPool(m, size) {
  for (let i = 0; i < size; i++) {
    await m.getFeed(i);
  }
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

  it("prefetches missing pool slots while filling, without creating clips past the pool", async () => {
    const { m } = machineWith({ poolSize: 8 });
    await m.getFeed(0);
    const feed = await m.getFeed(5);
    assert.deepEqual(
      feed.clips.map((c) => c.feedIndex),
      [5, 6, 7],
    );
    assert.deepEqual(
      feed.clips.map((c) => c.slot),
      [5, 6, 7],
    );
    assert.equal(m.startCounts.t2vTotal, 6);
  });

  it("uses default h3 model, not ltx", async () => {
    const { m } = machineWith();
    const feed = await m.getFeed(0);
    assert.equal(m.defaultModel, "h3");
    assert.equal(feed.clips[0].model, "h3");
  });
});

describe("clip pool", () => {
  it("after 20 slots filled, getFeed(100) does not start more T2V", async () => {
    const { m } = machineWith({ poolSize: POOL_SIZE });
    await fillPool(m, POOL_SIZE);
    assert.equal(m.startCounts.t2vTotal, 20);
    assert.equal(m.poolStatus().filled, 20);
    const feed = await m.getFeed(100);
    assert.equal(m.startCounts.t2vTotal, 20);
    assert.equal(feed.clips[0].slot, 0);
    assert.equal(feed.clips[0].feedIndex, 100);
    assert.equal(feed.clips[1].slot, 1);
    assert.equal(feed.clips[2].slot, 2);
  });

  it("getFeed(20) serves slot 0 (wrap)", async () => {
    const { m } = machineWith();
    await m.getFeed(0);
    const feed = await m.getFeed(20);
    assert.equal(feed.clips[0].slot, 0);
    assert.equal(feed.clips[0].feedIndex, 20);
    assert.equal(feed.clips[0].index, 20);
    assert.equal(feed.clips[0].id, m.raw(0).id);
    assert.equal(m.startCounts.t2v.get(0), 1);
    assert.equal(m.startCounts.t2vTotal, 3);
  });

  it("refresh appends a new slot and leaves original ids unchanged", async () => {
    const { m } = machineWith({ poolSize: 4 });
    await fillPool(m, 4);
    const before = m.startCounts.t2vTotal;
    const idsBefore = [0, 1, 2, 3].map((s) => m.raw(s).id);
    const result = m.refresh();
    assert.equal(result.ok, true);
    assert.equal(result.slot, 4);
    assert.equal(m.startCounts.t2vTotal, before + 1);
    const idsAfter = [0, 1, 2, 3].map((s) => m.raw(s).id);
    assert.deepEqual(idsAfter, idsBefore);
    assert.equal(m.poolStatus().filled, 5);
    assert.equal(m.raw(4).slot, 4);

    const feed = await m.getFeed(4);
    assert.equal(feed.clips[0].slot, 4);
    assert.equal(feed.clips[0].feedIndex, 4);
    assert.equal(feed.clips[0].id, m.raw(4).id);
  });

  it("does not generate fallback for recycled views of a ready slot", async () => {
    const { m, t2v, fallback } = machineWith({ poolSize: 4 });
    await m.getFeed(0);
    fallback.get(0).resolve({ videoUrl: "/f.mp4", posterUrl: "/p.jpg" });
    t2v.get(0).resolve({ requestId: "r", videoUrl: "/t.mp4" });
    await m.raw(0)._t2v;
    const fbBefore = m.startCounts.fallback.get(0);
    const t2vBefore = m.startCounts.t2v.get(0);
    const feed = await m.getFeed(4);
    assert.equal(feed.clips[0].slot, 0);
    assert.equal(feed.clips[0].status, "ready");
    assert.equal(m.startCounts.fallback.get(0), fbBefore);
    assert.equal(m.startCounts.t2v.get(0), t2vBefore);
  });

  it("hydrates ready slots from a manifest without kicking T2V", async () => {
    const hydrate = {
      version: 1,
      poolSize: 4,
      promptSeq: 4,
      lastRefreshAt: 1,
      slots: [0, 1, 2, 3].map((slot) => ({
        slot,
        id: `slop-${slot}-ready`,
        handle: `@h${slot}`,
        caption: `c${slot}`,
        prompt: `p${slot}`,
        model: "h3",
        t2vUrl: `/api/media/slop-${slot}-t2v.mp4`,
        t2vFile: `slop-${slot}-t2v.mp4`,
        createdAt: slot + 1,
      })),
    };
    const { m } = machineWith({ poolSize: 4, hydrate });
    const feed = await m.getFeed(0);
    assert.equal(m.startCounts.t2vTotal, 0);
    assert.equal(m.startCounts.fallbackTotal, 0);
    assert.equal(feed.clips[0].id, "slop-0-ready");
    assert.equal(feed.clips[0].status, "ready");
    assert.equal(feed.clips[0].videoUrl, "/api/media/slop-0-t2v.mp4");
    const wrapped = await m.getFeed(8);
    assert.equal(wrapped.clips[0].slot, 0);
    assert.equal(m.startCounts.t2vTotal, 0);
  });

  it("persists slot records including local media files", async () => {
    const saved = [];
    const { m, t2v, fallback } = machineWith({
      poolSize: 4,
      persist: (snap) => saved.push(snap),
    });
    await m.getFeed(0);
    fallback.get(0).resolve({
      videoUrl: "/api/media/slop-0-0.mp4",
      posterUrl: "/api/media/slop-0-0.jpg",
    });
    await m.getFeed(0, { waitFallbackMs: 50 });
    t2v.get(0).resolve({ requestId: "r", videoUrl: "/api/media/slop-0-0-t2v.mp4" });
    await m.raw(0)._t2v;
    assert.ok(saved.length >= 1);
    const last = saved[saved.length - 1];
    const slot0 = last.slots.find((s) => s.slot === 0);
    assert.equal(slot0.t2vFile, "slop-0-0-t2v.mp4");
    assert.equal(slot0.fallbackFile, "slop-0-0.mp4");
    assert.equal(slot0.posterFile, "slop-0-0.jpg");
  });

  it("serialized clips include feedIndex, slot, and a stable per-slot id", async () => {
    const { m } = machineWith({ poolSize: 4 });
    const feed = await m.getFeed(6);
    assert.equal(feed.poolSize, 4);
    assert.equal(feed.clips[0].feedIndex, 6);
    assert.equal(feed.clips[0].slot, 2);
    assert.equal(feed.clips[0].id, m.raw(2).id);
    assert.equal(feed.clips[1].slot, 3);
    assert.equal(feed.clips[2].slot, 0);
  });

  it("hydrate 4 ready slots, refresh appends 5th without deleting hydrated ids", async () => {
    const hydrate = {
      version: 1,
      poolSize: 4,
      promptSeq: 4,
      lastRefreshAt: 1,
      slots: [0, 1, 2, 3].map((slot) => ({
        slot,
        id: `slop-${slot}-ready`,
        handle: `@h${slot}`,
        caption: `c${slot}`,
        prompt: `p${slot}`,
        model: "h3",
        t2vUrl: `/api/media/slop-${slot}-t2v.mp4`,
        t2vFile: `slop-${slot}-t2v.mp4`,
        createdAt: slot + 1,
      })),
    };
    const { m } = machineWith({ poolSize: 4, hydrate });
    const idsBefore = [0, 1, 2, 3].map((s) => m.raw(s).id);
    const result = m.refresh();
    assert.equal(result.ok, true);
    assert.equal(result.slot, 4);
    assert.deepEqual(
      [0, 1, 2, 3].map((s) => m.raw(s).id),
      idsBefore,
    );
    assert.equal(m.poolStatus().filled, 5);
    assert.equal(m.raw(4).slot, 4);
  });

  it("hydrate does not shrink a library larger than targetFill", async () => {
    const hydrate = {
      version: 1,
      poolSize: 4,
      promptSeq: 5,
      lastRefreshAt: 1,
      slots: [0, 1, 2, 3, 4].map((slot) => ({
        slot,
        id: `slop-${slot}-ready`,
        handle: `@h${slot}`,
        caption: `c${slot}`,
        prompt: `p${slot}`,
        model: "h3",
        t2vUrl: `/api/media/slop-${slot}-t2v.mp4`,
        t2vFile: `slop-${slot}-t2v.mp4`,
        createdAt: slot + 1,
      })),
    };
    const { m } = machineWith({ poolSize: 4, hydrate });
    assert.equal(m.poolStatus().filled, 5);
    const feed = await m.getFeed(4);
    assert.equal(feed.clips[0].slot, 4);
    assert.equal(feed.clips[0].id, "slop-4-ready");
    assert.equal(m.startCounts.t2vTotal, 0);
    const wrapped = await m.getFeed(5);
    assert.equal(wrapped.clips[0].slot, 0);
    assert.equal(wrapped.clips[0].id, "slop-0-ready");
  });
});
