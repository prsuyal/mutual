import { PrismaClient } from "@prisma/client";
import { anthropic } from "@/lib/claude";
import { geocodeCity, searchText } from "@/lib/maps";

const db = new PrismaClient();

type Payload = {
  handle: string;
  companions?: string[];
  city?: string;
  budgetMax?: number | null;
  occasion?: string | null;
};


function extractSuggestionsFromClaude(res: any): Array<{ title: string; reason: string; hint?: string }> {
  const content = Array.isArray(res?.content) ? res.content : [];

  // A) Prefer tool_use -> input.suggestions
  const toolUse = content.find((b: any) => b?.type === "tool_use" && b?.name === "return_suggestions");
  const fromTool = toolUse?.input?.suggestions;
  if (Array.isArray(fromTool) && fromTool.length) return fromTool;

  // B) Otherwise, try to parse any text blocks as JSON
  const text = content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim();
  if (text) {
    // Try strict JSON
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.suggestions) && parsed.suggestions.length) return parsed.suggestions;
    } catch {}
    // Try to scrape simple bullet/numbered lines into {title, reason, hint}
    const lines = text.split("\n").map((l : any)=> l.trim()).filter(Boolean).slice(0, 5);
    const guessed = lines.map((l : any) => {
      const withoutNum = l.replace(/^\s*\d+[\).\-\:]\s*/, "");
      const parts = withoutNum.split(/[-–—:]\s+/); // title — reason
      const title = (parts[0] ?? "").trim();
      const rest = (parts.slice(1).join(" - ") || "").trim();
      const hintMatch = rest.match(/\b(?:hint|keywords?)\s*[:\-]\s*(.+)$/i);
      const reason = (hintMatch ? rest.replace(hintMatch[0], "") : rest).trim() || "Fits the group’s tags and budget.";
      const hint = hintMatch?.[1]?.trim();
      return title ? { title, reason, ...(hint ? { hint } : {}) } : null;
    }).filter(Boolean) as Array<{ title: string; reason: string; hint?: string }>;
    if (guessed.length >= 3) return guessed.slice(0, 5);
  }

  return [];
}


export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    if (!body?.handle) {
      return Response.json({ ok: false, error: "handle required" }, { status: 400 });
    }

    const handles = [body.handle, ...(Array.isArray(body.companions) ? body.companions : [])];

    const users = await db.user.findMany({
      where: { handle: { in: handles } },
      select: { id: true, handle: true, name: true },
    });
    if (users.length === 0) {
      return Response.json({ ok: false, error: "no_users_found" }, { status: 404 });
    }

    const reviews = await db.review.findMany({
      where: { userId: { in: users.map((u: {id: any}) => u.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        rating: true,
        tags: true,
        activity: { select: { name: true, placeId: true, type: true } },
      },
    });

    const tagWeights: Record<string, number> = {};
    for (const r of reviews) for (const t of r.tags) tagWeights[t] = (tagWeights[t] || 0) + (r.rating ?? 0);
    const topTags = Object.entries(tagWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t]) => t);

    const likedMap = new Map<string, { name: string; placeId: string | null }>();
    for (const r of reviews) {
      if ((r.rating ?? 0) >= 4 && r.activity?.name) {
        const key = r.activity.placeId || r.activity.name;
        if (!likedMap.has(key)) likedMap.set(key, { name: r.activity.name, placeId: r.activity.placeId || null });
      }
    }
    const liked = Array.from(likedMap.values()).slice(0, 10);

    let suggestions: Array<{ title: string; reason: string; hint?: string }> = [];

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 600,
          system:
            "you are a planner. given tastes/tags, city, budget, occasion, return 3 to 5 concrete activity ideas. You MUST use the return_suggestions tool and provide all outputs only via that tool. Do not write normal text.",
          tools: [
            {
              name: "return_suggestions",
              description: "return ranked activity suggestions for this group.",
              input_schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  suggestions: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        reason: { type: "string" },
                        hint: { type: "string" }, 
                      },
                      required: ["title", "reason"],
                    },
                  },
                },
                required: ["suggestions"],
              },
            },
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    `city: ${body.city ?? "unknown"}`,
                    `budget max: ${body.budgetMax ?? "unknown"}`,
                    `occasion: ${body.occasion ?? "none"}`,
                    `group: ${handles.join(", ")}`,
                    `top tags: ${topTags.length ? topTags.join(", ") : "(none)"}`,
                    liked.length
                      ? `prev liked venues: ${liked.map((v) => v.name).join(", ")}`
                      : `no prev likes recorded.`,
                    `return 3 to 5 suggestions via the return_suggestions tool ONLY.`,
                  ].join("\n"),
                },
              ],
            },
          ],
        } as any);

        const blocks = Array.isArray((res as any).content) ? (res as any).content : [];
        const toolUse = blocks.find((b: any) => b?.type === "tool_use" && b?.name === "return_suggestions");
        const returned = toolUse?.input?.suggestions;
        if (Array.isArray(returned)) suggestions = returned;
      } catch (e) {
        console.error("claude tool_call error:", e);
      }
    }

    if (!suggestions.length) {
      return Response.json({
        ok: true,
        group: handles,
        city: body.city ?? null,
        budgetMax: body.budgetMax ?? null,
        topTags,
        liked,
        suggestions: [],
      });
    }

    const loc = body.city ? await geocodeCity(body.city) : null;
    const priceToMaps = (budget?: number | null) =>
      typeof budget === "number" ? (budget <= 20 ? 1 : budget <= 50 ? 2 : budget <= 80 ? 3 : 4) : undefined;

    const enriched = [];
    for (const s of suggestions.slice(0, 3)) {
      const keywords = s.hint?.trim() || [s.title, ...(topTags || [])].filter(Boolean).join(" ");
      const query = body.city ? `${keywords} ${body.city}` : keywords;

      const places = await searchText({
        query,
        location: loc,
        radius: 6000,
        maxprice: priceToMaps(body.budgetMax),
        limit: 1,
      });

      enriched.push({ title: s.title, reason: s.reason, query, places });
    }

    return Response.json({
      ok: true,
      group: handles,
      city: body.city ?? null,
      budgetMax: body.budgetMax ?? null,
      topTags,
      liked,
      suggestions: enriched,
    });
  } catch (err: any) {
    console.error(err);
    return Response.json({ ok: false, error: err?.message || "server_error" }, { status: 500 });
  }
}