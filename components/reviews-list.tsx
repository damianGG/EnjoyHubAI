import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star } from "lucide-react"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  users: {
    full_name: string
  }
}

interface ReviewsListProps {
  reviews: Review[]
  avgRating: number
}

export default function ReviewsList({ reviews, avgRating }: ReviewsListProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No reviews yet. Be the first to leave a review!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          <span>{avgRating}</span>
          <span className="text-muted-foreground">• {reviews.length} reviews</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {reviews.slice(0, 6).map((review) => (
            <div key={review.id} className="flex space-x-4">
              <Avatar>
                <AvatarFallback>{review.users.full_name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-semibold">{review.users.full_name}</span>
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{new Date(review.created_at).toLocaleDateString()}</p>
                <p className="text-sm leading-relaxed">{review.comment}</p>
              </div>
            </div>
          ))}

          {reviews.length > 6 && (
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">Showing 6 of {reviews.length} reviews</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
