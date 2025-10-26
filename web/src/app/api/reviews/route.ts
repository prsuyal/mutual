import { PrismaClient } from "@prisma/client";
export const runtime = 'nodejs'
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { Tagesschrift } from "next/font/google";


const db = new PrismaClient();

async function getOrCreateTasteAgent(handle: string) {
  const token = process.env.LETTA_API_KEY;
  const project = process.env.LETTA_PROJECT_ID;
  if (!token || !project) return null;

  const resList = await fetch("https://api.letta.ai/v1/agents.list", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ project_id: project, external_id: `taste:${handle}` }),
  }).then(r => r.ok ? r.json() : null).catch(() => null);

  const existing = resList?.data?.[0];
  if (existing) return existing;

  const resCreate = await fetch("https://api.letta.ai/v1/agents.create", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      project_id: project,
      external_id: `taste:${handle}`,
      name: `TasteAgent:${handle}`,
      memoryBlocks: [
        { label: "human", value: `handle=${handle}`, limit: 1000 },
        { label: "persona", value: "you maintain the user's evolving taste from reviews and check-ins.", limit: 1000 },
      ],
    }),
  }).then(r => r.ok ? r.json() : null).catch(() => null);

  return resCreate;
}

async function appendTasteMemory(agentId: string, memo: Record<string, unknown>) {
  const token = process.env.LETTA_API_KEY;
  if (!token || !agentId) return;
  await fetch(`https://api.letta.ai/v1/agents/${agentId}/memories.create`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      label: "taste",
      value: JSON.stringify({ ...memo, ts: Date.now() }),
      limit: 2000,
    }),
  }).catch(() => null);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const handle: string | undefined = body?.handle;
    const placeId: string | undefined = body?.placeId;
    const name: string | undefined = body?.name;
    const rating: number | undefined = body?.rating;
    const tags: string | undefined = body?.tags;
    const text: string = typeof body?.text === "string" ? body.text : "";

    if (!handle || !placeId || !name || typeof rating !== "number") {
      return Response.json(
        { ok: false, error: "required: handle, placeId, name, rating(number)" },
        { status: 400 }
      );
    }
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !session.user) {
      throw new Error("Unauthorized: No active session")
    }
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        handle: true 
      },
    })

    const activity = await db.activity.upsert({
      where: { placeId },
      update: { name },
      create: { placeId, name },
    });

      const review = await db.review.create({
        data: {
          userId: user.id,
          activityId: activity.id,
          rating,
          text,
        },
      });
    

    if (process.env.LETTA_API_KEY && process.env.LETTA_PROJECT_ID) {
      const tasteAgent = await getOrCreateTasteAgent(handle);
      const agentId = tasteAgent?.id || tasteAgent?.data?.id;
      if (agentId) {
        await appendTasteMemory(agentId, { placeId, rating, tags, text }).catch(() => null);
      }
    }

    return Response.json({ ok: true, reviewId: review.id });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}

