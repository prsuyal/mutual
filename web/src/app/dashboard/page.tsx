"use client";

import Image from "next/image";
import logo from "../../../public/logo.svg";
import { useEffect, useMemo, useRef, useState } from "react";
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

type Friend = {
  friendshipId: string;
  user: {
    id: string;
    handle: string;
    name: string;
    image: string | null;
  };
  since: string;
};

type FriendRequest = {
  id: string;
  sender?: {
    id: string;
    handle: string;
    name: string;
    image: string | null;
  };
  receiver?: {
    id: string;
    handle: string;
    name: string;
    image: string | null;
  };
  createdAt: string;
};

type Mode = "explore" | "review";

export default function Page() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [currentUser, setCurrentUser] = useState<{ handle: string } | null>(null)
  
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router])
  
  useEffect(() => {
    async function fetchCurrentUser() {
      if (session?.user?.id) {
        const res = await fetch('/api/user/me')
        const data = await res.json()
        setCurrentUser(data)
      }
    }
    fetchCurrentUser()
  }, [session])

  console.log(currentHandle)

  const [mode, setMode] = useState<Mode>("explore");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

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
        .filter((h) => h !== currentHandle) || [];
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

  useEffect(() => inputRef.current?.focus(), []);

  async function onSubmit() {
    if (mode === "explore") {
      setLoading(true);
      try {
        const res = await fetch("/api/plans/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            handle: currentHandle,
            companions: parsed.companions,
            city: parsed.city || undefined,
            budgetMax: parsed.budgetMax ?? undefined,
            occasion: parsed.occasion,
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

    if (isPending) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      );
    }
    if (!session) {
      return null;
    }
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="min-h-screen relative flex">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <Image src={logo} alt="Logo" width={34} height={34} />
            <span className="font-medium tracking-tight">mutual</span>
          </div>
          <div className="pt-24">
            {!isPending && session?.user && (
              <div className="mx-auto max-w-3xl px-4 text-center">
                <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-tight text-black">
                  hi, <span>{currentHandle}</span>
                </h1>
                <p className="mt-3 text-base md:text-lg text-gray-500">
                  tell us what you’re in the mood for.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center pt-36 pb-10">
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
                  placeholder={
                    mode === "explore"
                      ? 'Ask anything… e.g. "with @pranshu in san francisco under $30 for a birthday"'
                      : 'Add quick tags… e.g. "cozy, great milk texture, romantic vibe"'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSubmit()}
                  className="h-12 rounded-xl pl-4 pr-28"
                />
                <Button
                  onClick={onSubmit}
                  disabled={loading}
                  className="absolute right-1.5 top-1.5 h-9 rounded-lg px-4 bg-purple-600 hover:bg-purple-700 text-white transition-all"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Go"
                  )}
                </Button>
              </div>

              {mode === "explore" ? (
                <div className="text-xs text-muted-foreground">
                  Detected → {parsed.companions.join(", ") || "no friends"},{" "}
                  {parsed.city || "no city"},{" "}
                  {parsed.budgetMax ? `$${parsed.budgetMax}` : "no budget"},{" "}
                  {parsed.occasion || "no occasion"}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Add your review notes, then we'll help you find the place.
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-16 space-y-3">
            {suggestions.length === 0 && !loading ? (
              <div className="text-sm text-muted-foreground text-center">
                No suggestions yet.
              </div>
            ) : null}

            {suggestions.map((s, idx) => {
              const place = s.places?.[0];
              const mapsLink = place?.placeId
                ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
                : undefined;

              return (
                <Card key={idx} className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="text-base font-medium">{s.title}</div>
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
                    {place?.name ? (
                      <div className="text-sm">{place.name}</div>
                    ) : null}
                    {place?.address ? (
                      <div className="text-sm text-muted-foreground">
                        {place.address}
                      </div>
                    ) : null}
                    <div className="text-sm">{s.reason}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <ReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            currentHandle={currentHandle!}
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

function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentHandle: string;
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
          handle: currentHandle,
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
                <Label>Review notes / tags</Label>
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

export function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const session = await authClient.useSession()
        if (session?.data?.user) setUser(session.data.user)
      } catch (err) {
        console.error("Failed to fetch session:", err)
      }
    }
    fetchSession()
  }, [])

  const handleLogout = async () => {
    try {
      await authClient.signOut()
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  };

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
                src={user.image || "/default-avatar.png"}
                alt="User avatar"
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">{user.name || "Anonymous"}</span>
                <span className="text-xs text-gray-500 truncate">{user.id}</span>
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
  )
}
