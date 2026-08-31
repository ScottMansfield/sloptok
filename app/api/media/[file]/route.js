import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "../../../../lib/store.js";

export const dynamic = "force-dynamic";

const TYPES = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webm": "video/webm",
};

export async function GET(_req, ctx) {
  const { file } = await ctx.params;
  if (!file || !/^[A-Za-z0-9._-]+$/.test(file)) {
    return new Response("bad file", { status: 400 });
  }
  const full = path.resolve(DATA_DIR, file);
  if (!full.startsWith(path.resolve(DATA_DIR))) {
    return new Response("nope", { status: 400 });
  }
  try {
    const buf = await readFile(full);
    const ext = path.extname(file).toLowerCase();
    return new Response(buf, {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("missing", { status: 404 });
  }
}
