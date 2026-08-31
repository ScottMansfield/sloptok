import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  queueSubmit,
  queueStatus,
  pollUntilDone,
  queueSubmitUrl,
  queueStatusUrl,
  queueResultUrl,
  extractVideoUrl,
} from "../lib/fal-queue.js";
import { MODELS, DEFAULT_MODEL } from "../lib/models.js";
import { kenBurnsArgs, zoompanFilter } from "../lib/kenburns.js";

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

describe("fal queue client", () => {
  it("submits to queue.fal.run with Key auth and does not subscribe", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return jsonRes(200, { request_id: "abc", status: "IN_QUEUE" });
    };
    const out = await queueSubmit("minimax/h3/text-to-video", { prompt: "hi" }, {
      fetchImpl,
      falKey: "test-key",
    });
    assert.equal(out.requestId, "abc");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://queue.fal.run/minimax/h3/text-to-video");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.Authorization, "Key test-key");
    assert.equal(JSON.parse(calls[0].init.body).prompt, "hi");
  });

  it("polls status then fetches result on COMPLETED", async () => {
    const calls = [];
    let n = 0;
    const fetchImpl = async (url, init) => {
      calls.push({ url, method: init.method });
      n += 1;
      if (url.endsWith("/status")) {
        if (n < 3) return jsonRes(200, { status: "IN_QUEUE" });
        return jsonRes(200, { status: "COMPLETED" });
      }
      return jsonRes(200, { video: { url: "https://cdn.example/v.mp4" } });
    };
    const sleeps = [];
    const result = await pollUntilDone("minimax/h3/text-to-video", "abc", {
      fetchImpl,
      falKey: "test-key",
      intervalMs: 1,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    assert.equal(extractVideoUrl(result), "https://cdn.example/v.mp4");
    assert.ok(calls.some((c) => c.url.includes("/status")));
    assert.ok(calls.some((c) => c.url === "https://queue.fal.run/minimax/h3/text-to-video/requests/abc"));
    assert.ok(sleeps.length >= 1);
  });

  it("throws on FAILED without hanging", async () => {
    const fetchImpl = async () => jsonRes(200, { status: "FAILED", error: "nope" });
    await assert.rejects(
      () =>
        pollUntilDone("m", "id", {
          fetchImpl,
          falKey: "k",
          sleep: async () => {},
        }),
      /FAILED/,
    );
  });

  it("builds queue URLs for the default H3 model", () => {
    const model = MODELS[DEFAULT_MODEL].id;
    assert.equal(model, "minimax/h3/text-to-video");
    assert.equal(queueSubmitUrl(model), "https://queue.fal.run/minimax/h3/text-to-video");
    assert.equal(
      queueStatusUrl(model, "rid"),
      "https://queue.fal.run/minimax/h3/text-to-video/requests/rid/status",
    );
    assert.equal(
      queueResultUrl(model, "rid"),
      "https://queue.fal.run/minimax/h3/text-to-video/requests/rid",
    );
  });
});

describe("ken burns ffmpeg args", () => {
  it("zoompans a 768x1344 still for 6s at 25fps", () => {
    const vf = zoompanFilter();
    assert.match(vf, /768:1344/);
    assert.match(vf, /d=150/);
    assert.match(vf, /fps=25/);
    const args = kenBurnsArgs("in.jpg", "out.mp4");
    assert.ok(args.includes("ffmpeg") === false);
    assert.equal(args[0], "-y");
    assert.ok(args.includes("-vf"));
    assert.ok(args.includes("out.mp4"));
    assert.ok(args.includes("-an"));
  });
});
