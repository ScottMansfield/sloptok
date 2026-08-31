import { DEFAULT_MODEL, MODELS } from "../lib/models.js";
import { queueSubmit, pollUntilDone, extractVideoUrl } from "../lib/fal-queue.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  if (process.env.FAL_KEY) return;
  const fp = resolve(process.cwd(), ".env");
  if (!existsSync(fp)) return;
  for (const line of readFileSync(fp, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const useLtx = process.argv.includes("--ltx");
const model = useLtx ? MODELS.ltx : MODELS[DEFAULT_MODEL];
const prompt = "Vertical 9:16 dumpster-glam gas station at night, a glowing slurpee machine whispering tax advice, analog grain, no celebrities, no identifiable real people.";

const k = process.env.FAL_KEY;
if (!k) {
  console.error("missing server credential");
  process.exit(1);
}

console.error("slop: queue submit " + model.id);
const submitted = await queueSubmit(model.id, model.input(prompt));
console.error("slop: request_id " + submitted.requestId);
const result = await pollUntilDone(model.id, submitted.requestId, { intervalMs: 800, timeoutMs: 180000 });
const url = extractVideoUrl(result);
if (!url) {
  console.error("slop: no mp4 url");
  process.exit(1);
}
console.log(url);
