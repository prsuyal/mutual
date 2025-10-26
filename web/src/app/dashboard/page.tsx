"use client";

import Image from "next/image";
import logo from "../../../public/logo.svg";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Menu } from "lucide-react";
import { FriendsDialog } from "@/components/friends-dialog";

type Place = {
  placeId: string;
  name: string;
  address?: string | null;
  rating?: number | null;
  location?: { lat: number; lng: number } | null;
};

type Suggestion = {
  title: string;
  reason: string;
  query?: string;
  places: Place[];
};

type Mode = "explore" | "review";

type Coords = { lat: number; lng: number };

const first = (name?: string | null) => name?.trim().split(/\s+/)[0] || null;

// 👇 Rotating example prompts
const EXPLORE_HINTS = [
  "w @pranshu in san fran for $20 for a birthday",
  "food nearby",
  "in seattle for 4 more hours — anything interesting?",
  "date night ideas under $50",
  "coffee near me that’s open late",
];

const REVIEW_HINTS = [
  "scrumptious chicken sandwiches",
  "lot of traffic heading there",
  "friendly staff, overall amazing experience",
  "cozy vibes, great study spot",
  "too salty, service was slow",
];
function useTypewriter(
  phrases: string[],
  opts: {
    typeMs?: number;
    deleteMs?: number;
    holdMs?: number;
    startDelayMs?: number;
    restartKey?: any;
    paused?: boolean; // 👈 new
  } = {}
) {
  const {
    typeMs = 60,
    deleteMs = 30,
    holdMs = 1000,
    startDelayMs = 250,
    restartKey,
    paused = false,
  } = opts;

  const [out, setOut] = useState('');
  const [i, setI] = useState(0);
  const [k, setK] = useState(0);
  const [del, setDel] = useState(false);

  // reset when phrases/mode change
  useEffect(() => {
    setOut('');
    setI(0);
    setK(0);
    setDel(false);
  }, [phrases, restartKey]);

  useEffect(() => {
    if (paused || !phrases.length) return; // 👈 stop all timers immediately
    let t: number;
    const current = phrases[i % phrases.length];

    if (!del && k < current.length) {
      t = window.setTimeout(() => {
        setOut(current.slice(0, k + 1));
        setK(k + 1);
      }, typeMs);
    } else if (!del && k === current.length) {
      t = window.setTimeout(() => setDel(true), holdMs);
    } else if (del && k > 0) {
      t = window.setTimeout(() => {
        setOut(current.slice(0, k - 1));
        setK(k - 1);
      }, deleteMs);
    } else {
      t = window.setTimeout(() => {
        setI((i + 1) % phrases.length);
        setDel(false);
      }, startDelayMs);
    }

    return () => window.clearTimeout(t);
  }, [phrases, i, k, del, typeMs, deleteMs, holdMs, startDelayMs, paused]);

  return out;
}

export default function Page() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const router = useRouter();

  const { data: session, isPending } = authClient.useSession();

  const [currentUser, setCurrentUser] = useState<{ handle: string } | null>(
    null
  );
  const currentHandle = currentUser?.handle ?? null;
  const firstName = first(session?.user?.name);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    async function fetchCurrentUser() {
      if (!session?.user?.id) return;
      const res = await fetch("/api/user/me", { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUser(data ?? null);
    }
    fetchCurrentUser();
  }, [session?.user?.id]);

  const [mode, setMode] = useState<Mode>("explore");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const demoActive = !focused && prompt.length === 0;


  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locStatus, setLocStatus] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown");

  const [feedItems, setFeedItems] = useState<Suggestion[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedInitialized, setFeedInitialized] = useState(false);

  const typedPlaceholder = useTypewriter(
  demoActive ? (mode === 'explore' ? EXPLORE_HINTS : REVIEW_HINTS) : [],
  { restartKey: mode, paused: !demoActive }
);

  useEffect(() => {
    const perm = (navigator as any).permissions?.query;
    if (perm) {
      (perm({ name: "geolocation" as any }) as Promise<any>)
        .then((p) => {
          setLocStatus(p.state as any);
          p.onchange = () => setLocStatus(p.state as any);
        })
        .catch(() => setLocStatus("prompt"));
    } else {
      setLocStatus("prompt");
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const loadFeed = useCallback(async () => {
    if (!session?.user) return;
    setFeedLoading(true);
    try {
      const res = await fetch("/api/plans/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: currentHandle ?? undefined,
          coords: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
        }),
      });
      const json = await res.json();
      setFeedItems(Array.isArray(json?.suggestions) ? json.suggestions : []);
      setFeedInitialized(true);
    } catch (error) {
      console.error("Failed to load feed:", error);
      setFeedInitialized(true);
    } finally {
      setFeedLoading(false);
    }
  }, [session?.user, currentHandle, coords]);

  useEffect(() => {
    if (!isPending && session?.user && currentHandle && !feedInitialized) {
      loadFeed();
    }
  }, [isPending, session?.user, currentHandle, feedInitialized, loadFeed]);

  useEffect(() => {
    if (feedInitialized && coords) {
      loadFeed();
    }
  }, [coords, feedInitialized, loadFeed]);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState<string>("");
  const [selectedPlace, setSelectedPlace] = useState<{
    placeId: string;
    name: string;
  } | null>(null);

  const parsed = useMemo(() => {
    const lower = prompt.toLowerCase();
    const companions =
      Array.from(prompt.matchAll(/@\w+/g))
        .map((m) => m[0])
        .filter((h) => h !== (currentHandle ?? "")) || [];
    const city = / in ([a-zA-Z\s]+?)(?:$| under| for| with)/
      .exec(lower)?.[1]
      ?.trim();
    const budget = /(\$|under\s*)?(\d{1,4})/.exec(lower)?.[2]
      ? Number(/(\$|under\s*)?(\d{1,4})/.exec(lower)![2])
      : null;
    const occasion =
      /(birthday|date|anniversary|team|friends|family)/.exec(lower)?.[1] ??
      null;
    return { companions, city, budgetMax: budget, occasion };
  }, [prompt, currentHandle]);

  async function onSubmit() {
    if (mode === "explore") {
      setLoading(true);
      try {
        const res = await fetch("/api/plans/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            handle: currentHandle ?? undefined,
            companions: parsed.companions,
            city: parsed.city || undefined,
            budgetMax: parsed.budgetMax ?? undefined,
            occasion: parsed.occasion,
            coords: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
          }),
        });
        const json = await res.json();
        setSuggestions(json?.ok ? json.suggestions || [] : []);
      } finally {
        setLoading(false);
      }
    } else {
      setNotes(prompt);
      setReviewOpen(true);
    }

    if (isPending) return;
    if (!session) return;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="min-h-screen relative flex">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <Image src={logo} alt="Logo" width={34} height={34} />
            <span className="font-medium tracking-tight">mutual</span>
          </div>

          <div className="pt-40">
            {!isPending && session?.user && (
              <div className="mx-auto max-w-3xl px-4 text-center">
                <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-tight text-black">
                  Hey <span>{firstName}</span>
                </h1>
                <p className="mt-3 text-base md:text-lg text-gray-500">
                  What&apos;s the plan?
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center pt-10 pb-6">
            <div className="w-full max-w-2xl flex flex-col items-center gap-4">
              <div className="inline-flex rounded-full border bg-white/70 backdrop-blur p-1 shadow-sm">
                <TogglePill
                  active={mode === "explore"}
                  onClick={() => setMode("explore")}
                >
                  Explore
                </TogglePill>
                <TogglePill
                  active={mode === "review"}
                  onClick={() => setMode("review")}
                >
                  Review
                </TogglePill>
              </div>

              <div className="relative w-full">
  <Input
    ref={inputRef}
    placeholder=""
    value={prompt}
    onChange={(e) => setPrompt(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && onSubmit()}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    onPointerDown={() => setFocused(true)}
    className={[
      "h-12 rounded-xl pl-4 pr-28",
      demoActive ? "[caret-color:transparent]" : "",
    ].join(" ")}
  />

  {demoActive && (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 flex items-center"
  >
    <div className="pl-4 pr-28 w-full">
      <span className="text-muted-foreground whitespace-pre">
        {typedPlaceholder}
      </span>
      <span className="ml-0.5 inline-block align-middle h-[1.2em] w-px bg-gray-400 animate-pulse" />
    </div>
  </div>
)}


  <Button
    onClick={onSubmit}
    disabled={loading}
    className="absolute right-1.5 top-1.5 h-9 rounded-lg px-4 bg-purple-600 hover:bg-purple-700 text-white transition-all"
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
  </Button>
</div>




              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>
                  Location:&nbsp;
                  {locStatus === "granted" && coords
                    ? `using your location (${coords.lat.toFixed(
                        3
                      )}, ${coords.lng.toFixed(3)})`
                    : locStatus === "denied"
                    ? "permission denied — falling back to city text or default"
                    : "off — share location for nearby picks"}
                </span>
                {locStatus !== "granted" && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-6 px-2"
                    onClick={requestLocation}
                  >
                    Use my location
                  </Button>
                )}
              </div>

              {mode === "explore" ? (
                <div className="text-xs text-muted-foreground">
                  Detected → {parsed.companions.join(", ") || "no friends"},{" "}
                  {parsed.city || (coords ? "near me" : "no city")},{" "}
                  {parsed.budgetMax ? `$${parsed.budgetMax}` : "no budget"},{" "}
                  {parsed.occasion || "no occasion"}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Add your review notes, then we&apos;ll help you find the
                  place.
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-16 space-y-3">
            {suggestions.length === 0 && !loading ? (
              <div className="space-y-4">
                {feedLoading && feedItems.length === 0 ? (
                  <div className="grid gap-3">
                    <div className="h-24 rounded-2xl border animate-pulse bg-muted/40" />
                    <div className="h-24 rounded-2xl border animate-pulse bg-muted/40" />
                    <div className="h-24 rounded-2xl border animate-pulse bg-muted/40" />
                  </div>
                ) : (
                  <SuggestionCarousel
                    items={feedItems}
                    emptyFallback={
                      <div className="text-sm text-muted-foreground text-center">
                        Nothing yet—hit refresh to generate ideas.
                      </div>
                    }
                    onRefresh={loadFeed}
                    refreshing={feedLoading}
                    showRefresh
                  />
                )}
              </div>
            ) : null}

            {suggestions.length > 0 ? (
              <SuggestionCarousel items={suggestions} />
            ) : null}
          </div>

          <ReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            currentHandle={currentHandle}
            onSubmitted={() => {
              setPrompt("");
              setSelectedPlace(null);
            }}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlace}
            rating={rating}
            setRating={setRating}
            notes={notes}
            setNotes={setNotes}
          />
        </div>
      <HamburgerMenu />
    </div>
  </APIProvider>
);  
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-4 py-1.5 rounded-full text-sm transition-all",
        active
          ? "bg-purple-600 text-white"
          : "text-muted-foreground hover:text-purple-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const place = s.places?.[0];
  const mapsLink = place?.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
    : undefined;

  const displayTitle = `${s.title}${place?.name ? ` @ ${place.name}` : ""}`;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <div className="text-base font-medium">{displayTitle}</div>
        {mapsLink ? (
          <a
            className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
          >
            Open in Maps
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1">
        {place?.address ? (
          <div className="text-sm text-muted-foreground">{place.address}</div>
        ) : null}
        <div className="text-sm">{s.reason}</div>
      </CardContent>
    </Card>
  );
}

function SuggestionCarousel({
  items,
  emptyFallback,
  onRefresh,
  refreshing = false,
  showRefresh = false,
}: {
  items: Suggestion[];
  emptyFallback?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  showRefresh?: boolean;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= items.length) setIdx(items.length ? items.length - 1 : 0);
  }, [items.length, idx]);

  const go = (n: number) => {
    if (!items.length) return;
    const next = (n + items.length) % items.length;
    setIdx(next);
  };

  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    const THRESH = 40;
    if (dx > THRESH) go(idx - 1);
    else if (dx < -THRESH) go(idx + 1);
  };

  if (!items.length) {
    return (
      <div className="space-y-3">
        {showRefresh ? (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">For you</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        ) : null}
        {emptyFallback ?? (
          <div className="text-sm text-muted-foreground text-center">
            Nothing yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <SuggestionCard s={items[idx]} />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => go(idx - 1)}
            className="rounded-full"
          >
            ◀
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => go(idx + 1)}
            className="rounded-full"
          >
            ▶
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to card ${i + 1}`}
              onClick={() => setIdx(i)}
              className={[
                "h-2 w-2 rounded-full transition-all",
                i === idx
                  ? "bg-purple-600 w-4"
                  : "bg-gray-300 hover:bg-gray-400",
              ].join(" ")}
            />
          ))}
        </div>

        {showRefresh ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        ) : (
          <div className="w-[84px]" />
        )}
      </div>
    </div>
  );
}

function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentHandle: string | null;
  onSubmitted: () => void;
  selectedPlace: { placeId: string; name: string } | null;
  setSelectedPlace: (p: { placeId: string; name: string } | null) => void;
  rating: number;
  setRating: (n: number) => void;
  notes: string;
  setNotes: (s: string) => void;
}) {
  const {
    open,
    onOpenChange,
    currentHandle,
    onSubmitted,
    selectedPlace,
    setSelectedPlace,
    rating,
    setRating,
    notes,
    setNotes,
  } = props;

  const placesLib = useMapsLibrary("places");
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placesLib || !query) {
      setPredictions([]);
      return;
    }
    const svc = new (placesLib as any).AutocompleteService();
    svc.getPlacePredictions({ input: query }, (res: any[]) =>
      setPredictions(res || [])
    );
  }, [placesLib, query]);

  async function pickPrediction(p: any) {
    if (!placesLib) return;
    const svc = new (placesLib as any).PlacesService(
      document.createElement("div")
    );
    setLoading(true);
    svc.getDetails(
      { placeId: p.place_id, fields: ["place_id", "name"] },
      (detail: any) => {
        setLoading(false);
        if (detail?.place_id) {
          setSelectedPlace({
            placeId: detail.place_id,
            name: detail.name || "Unknown",
          });
          setPredictions([]);
          setQuery(detail.name || query);
        }
      }
    );
  }

  async function submitReview() {
    if (!selectedPlace) return;
    setLoading(true);
    try {
      const tagsArray = notes
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: currentHandle ?? undefined,
          placeId: selectedPlace.placeId,
          name: selectedPlace.name,
          rating,
          text: tagsArray,
        }),
      });

      onOpenChange(false);
      setQuery("");
      setNotes("");
      setRating(5);
      onSubmitted();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selectedPlace
              ? `Review ${selectedPlace.name}`
              : "Pick a place to review"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label>Search place</Label>
            <Input
              placeholder="Start typing a place name…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedPlace(null);
              }}
            />
            {predictions.length > 0 && !selectedPlace && (
              <div className="border rounded-md max-h-48 overflow-auto">
                {predictions.map((p) => (
                  <button
                    key={p.place_id}
                    onClick={() => pickPrediction(p)}
                    className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors"
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
            {selectedPlace && (
              <div className="text-sm text-muted-foreground">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {selectedPlace.name}
                </span>
              </div>
            )}
          </div>

          {selectedPlace && (
            <>
              <div className="grid gap-2">
                <Label>Rating (1–5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Review notes</Label>
                <Textarea
                  placeholder="e.g. cozy, great milk texture, romantic vibe"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <Button
                  disabled={loading}
                  onClick={submitReview}
                  className="bg-purple-600 hover:bg-purple-700 text-white transition-all"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit review"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const user = session?.user;

  return (
    <>
      <button
        className="p-3 m-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 transition-all fixed top-4 right-4 z-40"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`h-full w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out fixed right-0 top-0 z-40 flex flex-col justify-between ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div>
          <div className="flex justify-between items-center p-4 border-b">
            <span className="font-medium">Menu</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-purple-600"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {user && (
            <div className="flex items-center gap-3 p-4 border-b">
              <img
                src={(user as any).image || "/default-avatar.png"}
                alt="User avatar"
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">
                  {user.name || "Anonymous"}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {user.id}
                </span>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            <Button variant="outline" className="w-full">
              Previous Reviews
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFriendsOpen(true);
                setOpen(false);
              }}
            >
              Friends
            </Button>
          </div>
        </div>

        <div className="p-4">
          <Button
            onClick={handleLogout}
            className="w-full bg-purple-600 text-white hover:bg-purple-700"
          >
            Log Out
          </Button>
        </div>
      </div>

      <FriendsDialog open={friendsOpen} onOpenChange={setFriendsOpen} />
    </>
  );
}
