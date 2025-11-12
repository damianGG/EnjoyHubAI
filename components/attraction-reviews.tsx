"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  users: {
    full_name: string
    avatar_url?: string
  }
  user_location?: string
}

interface AttractionReviewsProps {
  reviews: Review[]
  avgRating: number
  totalReviews: number
}

export function AttractionReviews({ reviews, avgRating, totalReviews }: AttractionReviewsProps) {
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())

  const toggleReview = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews)
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId)
    } else {
      newExpanded.add(reviewId)
    }
    setExpandedReviews(newExpanded)
  }

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Dziś"
    if (diffDays === 1) return "Wczoraj"
    if (diffDays < 7) return `${diffDays} dni temu`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tygodni temu`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} miesięcy temu`
    return date.toLocaleDateString("pl-PL")
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recenzje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Brak recenzji. Bądź pierwszą osobą, która zostawi recenzję!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
          <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-base font-normal">· {totalReviews} recenzji</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.slice(0, 6).map((review) => {
            const isExpanded = expandedReviews.has(review.id)
            const shouldTruncate = review.comment && review.comment.length > 150

            return (
              <div key={review.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    {review.users.avatar_url && (
                      <AvatarImage src={review.users.avatar_url} alt={review.users.full_name} />
                    )}
                    <AvatarFallback>{review.users.full_name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-semibold text-sm">{review.users.full_name}</p>
                        {review.user_location && (
                          <p className="text-xs text-muted-foreground">{review.user_location}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{getRelativeDate(review.created_at)}</span>
                    </div>
                    {review.comment && (
                      <div>
                        <p className="text-sm leading-relaxed">
                          {shouldTruncate && !isExpanded
                            ? `${review.comment.substring(0, 150)}...`
                            : review.comment}
                        </p>
                        {shouldTruncate && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => toggleReview(review.id)}
                          >
                            {isExpanded ? "Pokaż mniej" : "Pokaż więcej"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {totalReviews > 6 && (
          <div className="mt-6 text-center">
            <Button variant="outline">Pokaż wszystkie {totalReviews} recenzji</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
