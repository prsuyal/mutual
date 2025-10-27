"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Star, Trash2, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Review = {
  id: string
  rating: number
  text: string | null
  createdAt: string
  activity: {
    id: string
    placeId: string
    name: string
    lat: number | null
    lng: number | null
  }
}

export function ReviewsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [search, setSearch] = useState("")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      fetchReviews()
    }
  }, [open])

  async function fetchReviews() {
    setLoading(true)
    try {
      const res = await fetch('/api/reviews')
      const data = await res.json()
      if (res.ok) {
        setReviews(data.reviews || [])
        data.reviews?.forEach((review: Review) => {
          if (review.activity.lat && review.activity.lng) {
            fetchAddress(review.activity.id, review.activity.lat, review.activity.lng)
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAddress(activityId: string, lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const data = await res.json()
      if (data.results && data.results[0]) {
        setAddresses(prev => ({
          ...prev,
          [activityId]: data.results[0].formatted_address
        }))
      }
    } catch (error) {
      console.error('Failed to fetch address:', error)
    }
  }

  async function deleteReview(reviewId: string) {
    setDeleting(reviewId)
    try {
      const res = await fetch('/api/reviews/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      })
      if (res.ok) {
        await fetchReviews()
      }
    } catch (error) {
      console.error('Failed to delete review:', error)
    } finally {
      setDeleting(null)
    }
  }

  const filteredReviews = reviews.filter(r => 
    r.activity.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.text && r.text.toLowerCase().includes(search.toLowerCase()))
  )

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>My Reviews ({reviews.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by place name or review text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? 'No reviews found' : 'No reviews yet'}
              </div>
            ) : (
              filteredReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium">{review.activity.name}</div>
                        <a
                          href={`https://www.google.com/maps/place/?q=place_id:${review.activity.placeId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-600 hover:text-purple-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {addresses[review.activity.id] ? (
                          <div className="text-sm text-muted-foreground">
                            {addresses[review.activity.id]}
                          </div>
                        ) : review.activity.lat && review.activity.lng ? (
                          <div className="text-sm text-muted-foreground">
                            Loading address...
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReview(review.id)}
                          disabled={deleting === review.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                        >
                          {deleting === review.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <span className="text-sm text-muted-foreground">
                        {review.rating}/5
                      </span>
                    </div>

                    {review.text && (
                      <div className="text-sm text-muted-foreground">
                        {review.text}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}