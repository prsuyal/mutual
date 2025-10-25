import { PrismaClient } from "@prisma/client";
import { anthropic } from "@/lib/claude";
const db = new PrismaClient();

type Payload = {
  handle: string;
  companions?: string[];    
  city?: string;            
  budgetMax?: number | null;
  occasion?: string | null; 
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    if (!body?.handle) {
      return Response.json({ ok: false, error: "handle required" }, { status: 400 });
    }
    const handles = [body.handle, ...(body.companions || [])];

    const users = await db.user.findMany({
      where: { handle: { in: handles } },
      select: { id: true, handle: true, name: true },
    });

    if (!users.length) {
      return Response.json({ ok: false, error: "no_users_found" }, { status: 404 });
    }

    const reviews = await db.review.findMany({
      where: { userId: { in: users.map((u: any) => u.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        rating: true,
        tags: true,
        activity: { select: { name: true, placeId: true, type: true } },
      },
    });

    const tagWeights: Record<string, number> = {};
    for (const r of reviews) {
      for (const t of r.tags) {
        tagWeights[t] = (tagWeights[t] || 0) + (r.rating ?? 0);
      }
    }
    const topTags = Object.entries(tagWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t]) => t);

    const liked = reviews
      .filter((r: any) => r.rating >= 4 && r.activity?.name)
      .slice(0, 10)
      .map((r: any) => ({ name: r.activity!.name!, placeId: r.activity!.placeId || null }));

    let suggestions: Array<{ title: string; reason: string; hint?: string }> = [];

if (process.env.ANTHROPIC_API_KEY) {
  try {
    const res = await anthropic.messages.create({
    model: "claude-sonnet-4-5-latest", 
    max_tokens: 600,
    system:
      "you are a planner. given tastes/tags, city, budget, occasion, return 3–5 activity suggestions",
    tools: [
      {
        name: "return_suggestions",
        description: "return ranked activity suggestions for this group",
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
                  hint: { type: "string" }
                },
                required: ["title", "reason"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              [
                `City: ${body.city ?? "unknown"}`,
                `Budget Max: ${body.budgetMax ?? "unknown"}`,
                `Occasion: ${body.occasion ?? "none"}`,
                `Group: ${handles.join(", ")}`,
                `TopTags: ${topTags.length ? topTags.join(", ") : "(none)"}`,
                liked.length
                  ? `Previously liked venues: ${liked.map((v: any) => v.name).join(", ")}`
                  : `No previous likes recorded.`,
                `Return 3–5 suggestions via the return_suggestions tool.`
              ].join("\n")
          }
        ]
      }
    ]
  });

  const toolUse = res.content.find(
    (b: any) => b.type === "tool_use" && b.name === "return_suggestions"
  ) as { type: "tool_use"; name: string; input: any } | undefined;

  if (toolUse?.input?.suggestions) {
    suggestions = toolUse.input.suggestions;
  }
  } catch (e) {
    console.error("Claude tool_call error:", e);
  }
}


    return Response.json({
      ok: true,
      users,
      topTags,
      liked,
      suggestions,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}