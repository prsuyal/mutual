export async function GET() {
  return Response.json({ ok: true, name: "mutual", ts: Date.now() });
}
