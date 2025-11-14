import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Map } from "lucide-react"

export default function MapSkeleton() {
  return (
    <Card className="h-full w-full">
      <CardContent className="p-0 relative h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Map className="h-12 w-12 animate-pulse" />
          <div className="text-sm font-medium">Ładowanie mapy...</div>
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Decorative skeleton elements to mimic map tiles */}
        <div className="absolute inset-0 opacity-20">
          <div className="grid grid-cols-4 gap-2 h-full p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-full rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
