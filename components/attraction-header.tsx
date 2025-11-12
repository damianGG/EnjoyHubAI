import { Star, MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AttractionHeaderProps {
  title: string
  city: string
  country: string
  host: {
    full_name: string
    avatar_url?: string
    city?: string
    country?: string
  } | null
  avgRating: number
  reviewsCount: number
}

export default function AttractionHeader({
  title,
  city,
  country,
  host,
  avgRating,
  reviewsCount,
}: AttractionHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>

      {/* Location and Host */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Host Info */}
        {host && (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={host.avatar_url} alt={host.full_name} />
              <AvatarFallback>{host.full_name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Host:</p>
              <p className="font-medium">
                {host.full_name}
                {host.city && host.country && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    – {host.city}, {host.country}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Location */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {city}, {country}
          </span>
        </div>
      </div>

      {/* Rating */}
      {reviewsCount > 0 && (
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold">{avgRating}</span>
          <span className="text-muted-foreground">
            · {reviewsCount} {reviewsCount === 1 ? "recenzja" : "recenzji"}
          </span>
        </div>
      )}
    </div>
  )
}
