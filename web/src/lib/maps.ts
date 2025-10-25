import { Client, LatLngLiteral } from "@googlemaps/google-maps-services-js";

const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) console.warn("GOOGLE_MAPS_API_KEY missing");

const client = new Client({});

export async function geocodeCity(city: string): Promise<LatLngLiteral | null> {
  if (!key || !city) return null;
  const r = await client.geocode({ params: { address: city, key } });
  const loc = r.data.results?.[0]?.geometry?.location;
  return loc ?? null;
}

type SearchTextArgs = {
  query: string;                 
  location?: LatLngLiteral | null;
  radius?: number;               
  minprice?: number | undefined; 
  maxprice?: number | undefined;
  limit?: number;               
};

export async function searchText(args: SearchTextArgs) {
  if (!key) return [];
  const { query, location, radius = 6000, minprice, maxprice, limit = 3 } = args;
  const params: any = { query, key, radius };
  if (location) params.location = location;
  if (minprice != null) params.minprice = minprice;
  if (maxprice != null) params.maxprice = maxprice;

  const r = await client.textSearch({ params });
  const results = r.data.results ?? [];
  return results.slice(0, limit).map((p: any) => ({
    placeId: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    priceLevel: p.price_level ?? null,
    address: p.formatted_address ?? null,
    location: p.geometry?.location ?? null,
    types: p.types ?? [],
  }));
}

export async function placeDetails(placeId: string) {
  if (!key) return null;
  const r = await client.placeDetails({
    params: {
      place_id: placeId,
      key,
      fields: [
        "place_id",
        "name",
        "formatted_address",
        "rating",
        "price_level",
        "geometry",
        "opening_hours",
        "types",
        "url",
        "user_ratings_total",
        "website",
        "international_phone_number",
        "photos",
      ],
    },
  });
  return r.data.result ?? null;
}
