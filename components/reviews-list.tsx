import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Star } from "lucide-react"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  author_name?: string | null
  verified_visit?: boolean | null
  users?: {
    full_name?: string | null
  } | null
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
          <CardTitle>Opinie</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nie ma jeszcze opinii.</p>
        </CardContent>
      </Card>
    )
  }

  const verifiedCount = reviews.filter((review) => review.verified_visit).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5">
            <Star className="h-5 w-5 fill-[#ff9f0a] text-[#ff9f0a]" />
            {avgRating}
          </span>
          <span className="text-muted-foreground">· {reviews.length} opinii</span>
          {verifiedCount > 0 && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />{verifiedCount} zweryfikowanych
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {reviews.slice(0, 6).map((review) => {
            const authorName = review.author_name || review.users?.full_name || "Gość EnjoyHub"
            return (
              <div key={review.id} className="flex space-x-4">
                <Avatar>
                  <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{authorName}</span>
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < review.rating ? "fill-[#ff9f0a] text-[#ff9f0a]" : "text-gray-300"}`}
                        />
                      ))}
                    </div>
                    {review.verified_visit && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                        <ShieldCheck className="h-3.5 w-3.5" /> Zweryfikowana wizyta
                      </span>
                    )}
                  </div>
                  <p className="mb-2 mt-1 text-sm text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("pl-PL")}
                  </p>
                  <p className="text-sm leading-relaxed">{review.comment}</p>
                </div>
              </div>
            )
          })}

          {reviews.length > 6 && (
            <div className="pt-4 text-center">
              <p className="text-sm text-muted-foreground">Pokazujemy 6 z {reviews.length} opinii</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
