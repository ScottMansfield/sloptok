import { getMachine } from "../../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const machine = await getMachine();
  return Response.json(machine.poolStatus());
}

export async function POST() {
  const machine = await getMachine();
  const result = machine.refresh();
  if (!result.ok) {
    const status = result.reason === "busy" ? 409 : 400;
    return Response.json(result, { status });
  }
  return Response.json(result);
}
