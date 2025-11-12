"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  users: {
    full_name: string
    avatar_url?: string
    city?: string
  } | null
}

interface AttractionReviewsProps {
  reviews: Review[]
  avgRating: number
  reviewsCount: number
}

export default function AttractionReviews({
  reviews,
  avgRating,
  reviewsCount,
}: AttractionReviewsProps) {
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const displayedReviews = showAll ? reviews : reviews.slice(0, 3)

  const toggleReviewExpansion = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews)
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId)
    } else {
      newExpanded.add(reviewId)
    }
    setExpandedReviews(newExpanded)
  }

  if (reviewsCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Recenzje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Brak recenzji. Bądź pierwszą osobą, która wystawi opinię!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl md:text-2xl">
          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            <span>{avgRating}</span>
          </div>
          <span className="text-muted-foreground">
            · {reviewsCount} {reviewsCount === 1 ? "recenzja" : "recenzji"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reviews List */}
        <div className="space-y-6">
          {displayedReviews.map((review) => {
            const isExpanded = expandedReviews.has(review.id)
            const shouldTruncate = review.comment && review.comment.length > 200
            const displayComment = isExpanded
              ? review.comment
              : review.comment?.substring(0, 200)

            return (
              <div key={review.id} className="space-y-3">
                {/* Reviewer Info */}
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={review.users?.avatar_url} alt={review.users?.full_name || "User"} />
                    <AvatarFallback>
                      {review.users?.full_name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-semibold">{review.users?.full_name || "Anonymous"}</p>
                        {review.users?.city && (
                          <p className="text-sm text-muted-foreground">{review.users.city}</p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), {
                          addSuffix: true,
                          locale: pl,
                        })}
                      </p>
                    </div>

                    {/* Rating Stars */}
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Comment */}
                    {review.comment && (
                      <div>
                        <p className="text-sm leading-relaxed">
                          {displayComment}
                          {shouldTruncate && !isExpanded && "..."}
                        </p>
                        {shouldTruncate && (
                          <Button
                            variant="link"
                            onClick={() => toggleReviewExpansion(review.id)}
                            className="p-0 h-auto text-sm font-semibold mt-1"
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

        {/* Show All Button */}
        {reviews.length > 3 && (
          <div className="text-center pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAll(!showAll)}>
              {showAll
                ? "Pokaż mniej recenzji"
                : `Pokaż wszystkie recenzje (${reviewsCount})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
