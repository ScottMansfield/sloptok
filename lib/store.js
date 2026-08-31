import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFeedMachine, PREFETCH } from "./feed-machine.js";
import { pickPrompt } from "./prompts.js";
import { DEFAULT_MODEL, getModel, MODELS } from "./models.js";
import {
  queueSubmit,
  pollUntilDone,
  extractVideoUrl,
  extractImageUrl,
} from "./fal-queue.js";
import { kenBurnsArgs } from "./kenburns.js";

const DATA_DIR = path.join(process.cwd(), "data", "clips");

function mediaUrl(filename) {
  return `/api/media/${filename}`;
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return dest;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}`));
    });
  });
}

async function ffmpegAvailable() {
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg missing"))));
    });
    return true;
  } catch {
    return false;
  }
}

export async function startFallback(clip) {
  await mkdir(DATA_DIR, { recursive: true });
  const flux = MODELS.flux;
  const submitted = await queueSubmit(flux.id, flux.input(clip.prompt));
  const result = await pollUntilDone(flux.id, submitted.requestId, {
    intervalMs: 400,
    timeoutMs: 45000,
  });
  const imageUrl = extractImageUrl(result);
  if (!imageUrl) throw new Error("flux produced no image");

  const jpgName = `${clip.id}.jpg`;
  const mp4Name = `${clip.id}.mp4`;
  const jpgPath = path.join(DATA_DIR, jpgName);
  const mp4Path = path.join(DATA_DIR, mp4Name);
  await downloadFile(imageUrl, jpgPath);

  if (await ffmpegAvailable()) {
    await runFfmpeg(kenBurnsArgs(jpgPath, mp4Path));
    return { videoUrl: mediaUrl(mp4Name), posterUrl: mediaUrl(jpgName) };
  }
  return { videoUrl: null, posterUrl: mediaUrl(jpgName) };
}

export async function startT2V(clip) {
  const model = getModel(clip.model);
  const submitted = await queueSubmit(model.id, model.input(clip.prompt));
  return { requestId: submitted.requestId };
}

export async function pollT2V(clip) {
  const model = getModel(clip.model);
  const result = await pollUntilDone(model.id, clip.requestId, {
    intervalMs: 800,
    timeoutMs: 180000,
  });
  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) return { error: "t2v produced no video" };
  return { videoUrl };
}

function createRealMachine() {
  return createFeedMachine({
    prefetch: PREFETCH,
    defaultModel: DEFAULT_MODEL,
    pickPrompt,
    startT2V,
    startFallback,
    pollT2V,
  });
}

const g = globalThis;
if (!g.__sloptokMachine) {
  g.__sloptokMachine = createRealMachine();
}

export function getMachine() {
  return g.__sloptokMachine;
}

export function resetMachineForTests() {
  g.__sloptokMachine = createRealMachine();
  return g.__sloptokMachine;
}

export { DATA_DIR };
