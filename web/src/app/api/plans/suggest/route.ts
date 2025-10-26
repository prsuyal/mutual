import { PrismaClient } from "@prisma/client";
import { anthropic } from "@/lib/claude";
import { geocodeCity, searchText } from "@/lib/maps";

const db = new PrismaClient();

type Coords = { lat: number; lng: number };

type Payload = {
  handle?: string | null;           
  city?: string | null;
  budgetMax?: number | null;
  occasion?: string | null;
  coords?: Coords | null;            
};

type Suggestion = { title: string; reason: string; hint?: string };

const priceToMaps = (budget?: number | null) =>
  typeof budget === "number" ? (budget <= 20 ? 1 : budget <= 50 ? 2 : budget <= 80 ? 3 : 4) : undefined;

function fallbackQueryForTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("eat") || t.includes("dinner") || t.includes("food")) return "restaurant";
  if (t.includes("brunch")) return "brunch";
  if (t.includes("coffee")) return "coffee shop";
  if (t.includes("dessert")) return "dessert";
  if (t.includes("park") || t.includes("walk")) return "park";
  if (t.includes("museum")) return "museum";
  if (t.includes("arcade")) return "arcade";
  if (t.includes("bowling")) return "bowling";
  return "interesting places";
}

function extractSuggestionsFromClaude(res: any): Suggestion[] {
  const content = Array.isArray(res?.content) ? res.content : [];
  const toolUse = content.find((b: any) => b?.type === "tool_use" && b?.name === "return_suggestions");
  const fromTool = toolUse?.input?.suggestions;
  if (Array.isArray(fromTool) && fromTool.length) return fromTool;

  const text = content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.suggestions) && parsed.suggestions.length) return parsed.suggestions;
    } catch {}
    const lines = text.split("\n").map((l:any)=>l.trim()).filter(Boolean).slice(0,5);
    const guessed = lines.map((l:any)=>{
      const withoutNum = l.replace(/^\s*\d+[\).\-\:]\s*/, "");
      const parts = withoutNum.split(/[-–—:]\s+/);
      const title = (parts[0] ?? "").trim();
      const rest = (parts.slice(1).join(" - ") || "").trim();
      const hintMatch = rest.match(/\b(?:hint|keywords?)\s*[:\-]\s*(.+)$/i);
      const reason = (hintMatch ? rest.replace(hintMatch[0], "") : rest).trim() || "Fits the group’s tags and budget.";
      const hint = hintMatch?.[1]?.trim();
      return title ? { title, reason, ...(hint ? { hint } : {}) } : null;
    }).filter(Boolean);
    if (guessed.length >= 3) return guessed.slice(0,5) as Suggestion[];
  }
  return [];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    const safeHandle = body.handle?.trim() || "anonymous";
    const handles = [safeHandle, ...(Array.isArray(body.companions) ? body.companions : [])];

    let topTags: string[] = [];
    let liked: Array<{ name: string; placeId: string | null }> = [];
    try {
      const users = await db.user.findMany({
        where: { handle: { in: handles } },
        select: { id: true, handle: true, name: true },
      });

      if (users.length) {
        const reviews = await db.review.findMany({
          where: { userId: { in: users.map((u) => u.id) } },
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
        topTags = Object.entries(tagWeights).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([t])=>t);

        const likedMap = new Map<string, { name: string; placeId: string | null }>();
        for (const r of reviews) {
          if ((r.rating ?? 0) >= 4 && r.activity?.name) {
            const key = r.activity.placeId || r.activity.name;
            if (!likedMap.has(key)) likedMap.set(key, { name: r.activity.name, placeId: r.activity.placeId || null });
          }
        }
        liked = Array.from(likedMap.values()).slice(0,10);
      }
    } catch (dbErr) {
      console.warn("suggest: personalization skipped due to DB error:", dbErr);
    }

    let suggestions: Suggestion[] = [];
    try {
      const locLine = body.coords
        ? "location: near provided coordinates"
        : `city: ${body.city ?? "unknown"}`;

      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system:
          "you are a planner. given tastes/tags, location (coords or city), budget, occasion, return 3–5 concrete activity ideas. You MUST use the return_suggestions tool and provide all outputs only via that tool. Do not write normal text.",
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
                  locLine,
                  body.coords ? `coords: ${body.coords.lat}, ${body.coords.lng}` : "",
                  `budget max: ${body.budgetMax ?? "unknown"}`,
                  `occasion: ${body.occasion ?? "none"}`,
                  `group: ${handles.join(", ")}`,
                  `top tags: ${topTags.length ? topTags.join(", ") : "(none)"}`,
                  liked.length
                    ? `prev liked venues: ${liked.map((v) => v.name).join(", ")}`
                    : `no prev likes recorded.`,
                  `return 3–5 suggestions via the return_suggestions tool ONLY.`,
                ].filter(Boolean).join("\n"),
              },
            ],
          },
        ],
      } as any);

      suggestions = extractSuggestionsFromClaude(res);
    } catch (e) {
      console.error("claude tool_call error:", e);
    }

    if (!suggestions.length) {
      return Response.json({
        ok: true,
        group: handles,
        city: body.city ?? null,
        coords: body.coords ?? null,
        budgetMax: body.budgetMax ?? null,
        topTags,
        liked,
        suggestions: [],
      });
    }

    let location: Coords | null = null;
    if (body.coords && Number.isFinite(body.coords.lat) && Number.isFinite(body.coords.lng)) {
      location = { lat: Number(body.coords.lat), lng: Number(body.coords.lng) };
    } else if (body.city) {
      location = await geocodeCity(body.city).catch(() => null);
    }

    const enriched: Array<{ title: string; reason: string; query: string; places: any[] }> = [];
    for (const s of suggestions.slice(0, 3)) {
      const baseKeywords =
        s.hint?.trim() ||
        [s.title, ...(topTags || [])].filter(Boolean).join(" ") ||
        fallbackQueryForTitle(s.title);

      const query = body.city ? `${baseKeywords} ${body.city}` : baseKeywords;

      const places = await searchText({
        query,
        location,
        radius: 6000,
        maxprice: priceToMaps(body.budgetMax),
        limit: 1,
      }).catch(() => []);

      enriched.push({ title: s.title, reason: s.reason, query, places: Array.isArray(places) ? places : [] });
    }

    return Response.json({
      ok: true,
      group: handles,
      city: body.city ?? null,
      coords: body.coords ?? null,
      budgetMax: body.budgetMax ?? null,
      topTags,
      liked,
      suggestions: enriched,
    });
  } catch (err: any) {
    console.error("suggest route fatal:", err);
    return Response.json({ ok: false, error: err?.message || "server_error" }, { status: 500 });
  }
}
