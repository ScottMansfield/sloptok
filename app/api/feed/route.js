import { getMachine } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const index = Math.max(0, Number(url.searchParams.get("index") || "0") || 0);
  const garnish = url.searchParams.get("garnish");
  const model = garnish === "ltx" ? "ltx" : undefined;
  const seed = url.searchParams.get("seed") || undefined;
  const machine = await getMachine();
  const feed = await machine.getFeed(index, { waitFallbackMs: 2800, model, seed });
  return Response.json(feed);
}
