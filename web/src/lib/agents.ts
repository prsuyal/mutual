import { letta } from "@/lib/letta";

export async function getOrCreateTasteAgent(handle: string) {
  const external_id = `taste:${handle}`;

  const list = await letta.agents.list({ external_id } as any);
  if (list && list.length > 0) return list[0];

  return await letta.agents.create({
    external_id,
    name: `TasteAgent:${handle}`,
    memoryBlocks: [
      { label: "human",  value: `handle=${handle}`, limit: 1000 },
      { label: "persona", value: "you track evolving user taste from reviews or check-ins.", limit: 1000 },
    ],
  } as any);
}

export async function getOrCreatePlannerAgent() {
  const external_id = "planner:global";
  const list = await letta.agents.list({ external_id } as any);
  if (list && list.length > 0) return list[0];

  return await letta.agents.create({
    external_id,
    name: "PlannerAgent",
    memoryBlocks: [
      { label: "persona", value: "plan 3–5 activities based on tastes + constraints. keep answers JSON-ready", limit: 1000 },
    ],
  } as any);
}

export async function appendTasteMemory(agentId: string, memo: {
  placeId: string; rating: number; tags?: string[]; text?: string; ts?: number;
}) {
  return await letta.blocks.create({
    agent_id: agentId,
    label: "taste",
    value: JSON.stringify({ ...memo, ts: memo.ts ?? Date.now() }),
    limit: 2000,
  } as any);
}