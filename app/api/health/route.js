export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    falKey: Boolean(process.env.FAL_KEY),
    defaultModel: "h3",
  });
}
