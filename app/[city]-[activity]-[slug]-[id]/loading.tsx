export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Gallery Skeleton */}
      <div className="w-full h-[400px] md:h-[500px] bg-muted animate-pulse" />

      <div className="container mx-auto px-4 py-8">
        {/* Header Skeleton */}
        <div className="space-y-4 mb-8">
          <div className="h-10 bg-muted rounded animate-pulse w-3/4" />
          <div className="flex gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-32" />
                <div className="h-4 bg-muted rounded animate-pulse w-48" />
              </div>
            </div>
          </div>
          <div className="h-5 bg-muted rounded animate-pulse w-40" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Skeleton */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            </div>

            {/* Cards */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>

          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <div className="h-96 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
