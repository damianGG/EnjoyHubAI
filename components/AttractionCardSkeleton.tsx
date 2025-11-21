import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AttractionCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Image skeleton */}
      <Skeleton className="aspect-video w-full rounded-t-xl" />

      {/* Content skeleton */}
      <CardContent className="p-2">
        <div className="space-y-0.5">
          {/* Title and rating row */}
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-12" />
          </div>

          {/* Location */}
          <Skeleton className="h-3 w-2/3" />

          {/* Reviews count */}
          <Skeleton className="h-3 w-1/2" />

          {/* Price */}
          <div className="pt-1">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
