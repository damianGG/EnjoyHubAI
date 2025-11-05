import { Loader2 } from "lucide-react"

export default function SearchLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading search results...</p>
      </div>
    </div>
  )
}
