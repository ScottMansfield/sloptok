import { getMachine } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET() {
  let pool = null;
  try {
    pool = getMachine().poolStatus();
  } catch {
    pool = null;
  }
  return Response.json({
    ok: true,
    falKey: Boolean(process.env.FAL_KEY),
    defaultModel: "h3",
    poolSize: pool?.poolSize ?? null,
    filled: pool?.filled ?? null,
  });
}
