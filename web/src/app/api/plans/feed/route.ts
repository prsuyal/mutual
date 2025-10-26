import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { geocodeCity, searchText } from "@/lib/maps"

type Coords = { lat: number; lng: number }

type Place = {
  placeId: string
  name: string
  address?: string | null
  rating?: number | null
  location?: { lat: number; lng: number } | null
}

type Suggestion = {
  title: string
  reason: string
  query?: string
  places: Place[]
}

type Payload = {
  handle?: string | null
  city?: string | null
  budgetMax?: number | null
  occasion?: string | null
  coords?: Coords | null
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  { title: "Coffee shop adventure", reason: "Find a cozy spot to hang", places: [] },
  { title: "Try a new cuisine", reason: "Branch out from your usual", places: [] },
  { title: "Weekend brunch", reason: "Relaxed morning with friends", places: [] },
  { title: "Scenic city walk", reason: "Explore a photogenic area", places: [] },
]

function extractJsonString(s: string): string | null {
  if (!s) return null
  let t = s.trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "").trim()
  }
  if (t.startsWith("{") && t.endsWith("}")) return t
  const first = t.indexOf("{")
  const last = t.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) return t.slice(first, last + 1)
  return null
}

function toSuggestions(input: any): Suggestion[] {
  const out: Suggestion[] = []
  if (!input || typeof input !== "object") return FALLBACK_SUGGESTIONS
  const arr = Array.isArray(input.suggestions) ? input.suggestions : []
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue
    const title = String(raw.title ?? "Discover something new").slice(0, 60)
    const reason = String(raw.reason ?? "A great spot to check out").slice(0, 140)
    const query = raw.query == null ? undefined : String(raw.query).slice(0, 120)
    const placesIn: any[] = Array.isArray(raw.places) ? raw.places : []
    const places: Place[] = []
    for (const p of placesIn) {
      if (!p || typeof p !== "object") continue
      const placeId = "placeId" in p ? String(p.placeId) : undefined
      const name = "name" in p ? String(p.name) : undefined
      if (!placeId || !name) continue
      const address = p.address == null ? null : String(p.address)
      const ratingNum = typeof p.rating === "number" && Number.isFinite(p.rating) ? p.rating : null
      const loc =
        p.location &&
        typeof p.location === "object" &&
        typeof p.location.lat === "number" &&
        typeof p.location.lng === "number"
          ? { lat: p.location.lat, lng: p.location.lng }
          : null
      places.push({ placeId, name, address, rating: ratingNum, location: loc })
    }
    out.push({ title, reason, query, places })
  }
  return out.length > 0 ? out : FALLBACK_SUGGESTIONS
}

function priceToMaps(budget?: number | null) {
  if (typeof budget !== "number") return undefined
  if (budget <= 20) return 1
  if (budget <= 50) return 2
  if (budget <= 80) return 3
  return 4
}

function fallbackQueryForTitle(title: string): string {
  const t = title.toLowerCase()
  if (t.includes("brunch")) return "brunch"
  if (t.includes("coffee")) return "coffee shop"
  if (t.includes("walk") || t.includes("scenic")) return "park viewpoint"
  if (t.includes("museum")) return "museum"
  if (t.includes("dessert")) return "dessert ice cream"
  if (t.includes("book")) return "bookstore"
  if (t.includes("music")) return "live music venue"
  if (t.includes("arcade")) return "arcade"
  if (t.includes("bowling")) return "bowling"
  if (t.includes("pizza")) return "pizza"
  if (t.includes("tacos")) return "tacos"
  return "interesting places"
}

async function enrichWithPlaces(
  suggestions: Suggestion[],
  {
    city,
    budgetMax,
    coords,
  }: { city?: string | null; budgetMax: number | null; coords?: Coords | null }
): Promise<Suggestion[]> {
  const resolvedCity = (city?.trim()) || (coords ? "" : "San Francisco")
  const loc: Coords | null =
    coords && typeof coords.lat === "number" && typeof coords.lng === "number"
      ? coords
      : await geocodeCity(resolvedCity || "San Francisco").catch(() => null)

  const maxprice = priceToMaps(budgetMax)
  const radius = 8000

  const enriched: Suggestion[] = []
  for (const s of suggestions) {
    const base = (s.query && s.query.trim()) || fallbackQueryForTitle(s.title)
    const query = [base, resolvedCity].filter(Boolean).join(" ").trim()

    const places = await searchText({
      query,
      location: loc,
      radius,
      maxprice,
      limit: 3,
    }).catch(() => [])

    enriched.push({
      ...s,
      query,
      places: Array.isArray(places) ? places : [],
    })
  }
  return enriched
}

async function runFeed(params: Payload) {
  const { handle, city, budgetMax, occasion, coords } = params

  const system = `You are a JSON generator for a discovery feed app.
Return ONLY a single valid JSON object. No explanations, no markdown, no prose.
If unsure, return: {"suggestions":[]}

Schema (must match EXACTLY):
{
  "suggestions": [
    {
      "title": "Short punchy title (<= 8 words)",
      "reason": "One sentence explanation",
      "places": []
    }
  ]
}

Rules:
- Generate 4-6 diverse activity suggestions based on user context.
- Titles under 8 words; reasons one sentence.
- Do not include code fences or any surrounding text.
- No trailing commas or comments.`

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      temperature: 0.8,
      system,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            user_handle: handle || "anonymous",
            city: city || (coords ? "near current location" : "San Francisco"),
            budget: Number.isFinite(budgetMax as any) ? budgetMax : "flexible",
            occasion: occasion || "general",
            instruction: "Generate 4-6 diverse activity suggestions",
          }),
        },
      ],
    })

    const rawText = (msg.content || [])
      .map((b: any) => (b?.type === "text" ? b.text : ""))
      .join("")
      .trim()

    const jsonStr = extractJsonString(rawText)
    let suggestions: Suggestion[] = FALLBACK_SUGGESTIONS

    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        suggestions = toSuggestions(parsed)
      } catch (e) {
        console.error("JSON.parse failed; using fallback. Error:", e)
        console.error("Raw (first 300 chars):", jsonStr.slice(0, 300))
      }
    } else {
      console.error("No JSON detected; using fallback.")
      console.error("Raw (first 300 chars):", rawText.slice(0, 300))
    }

    const enriched = await enrichWithPlaces(suggestions, {
      city,
      budgetMax: budgetMax ?? null,
      coords: coords ?? null,
    })

    return NextResponse.json({
      ok: true,
      city: city || null,
      coords: coords ?? null,
      budgetMax: Number.isFinite(budgetMax as any) ? budgetMax : null,
      suggestions: enriched,
    })
  } catch (error) {
    console.error("Feed generation error:", error)

    const enrichedFallback = await enrichWithPlaces(FALLBACK_SUGGESTIONS, {
      city: null,
      budgetMax: null,
      coords: null,
    }).catch(() => FALLBACK_SUGGESTIONS)

    return NextResponse.json(
      {
        ok: false,
        city: null,
        coords: null,
        budgetMax: null,
        suggestions: enrichedFallback,
        error: "Failed to generate feed",
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const handle = searchParams.get("handle")
  const city = searchParams.get("city")
  const latStr = searchParams.get("lat")
  const lngStr = searchParams.get("lng")
  const budgetMax = searchParams.get("budgetMax") ? Number(searchParams.get("budgetMax")) : null
  const occasion = searchParams.get("occasion")

  const lat = latStr ? Number(latStr) : NaN
  const lng = lngStr ? Number(lngStr) : NaN
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) ? ({ lat, lng } as Coords) : null

  return runFeed({
    handle,
    city,
    budgetMax: Number.isFinite(budgetMax as any) ? (budgetMax as number) : null,
    occasion,
    coords,
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { handle, city, budgetMax, occasion, coords } = (body || {}) as Payload

  const safeCoords =
    coords &&
    typeof coords === "object" &&
    Number.isFinite((coords as any).lat) &&
    Number.isFinite((coords as any).lng)
      ? { lat: Number((coords as any).lat), lng: Number((coords as any).lng) }
      : null

  return runFeed({
    handle: handle ?? null,
    city: city ?? null,
    budgetMax:
      typeof budgetMax === "number" && Number.isFinite(budgetMax) ? budgetMax : null,
    occasion: occasion ?? null,
    coords: safeCoords,
  })
}
