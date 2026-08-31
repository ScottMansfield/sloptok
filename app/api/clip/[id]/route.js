import { getMachine } from "../../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const machine = await getMachine();
  const clip = machine.getById(id);
  if (!clip) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(clip);
}
