import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, Search } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold">404</h1>
          <h2 className="text-2xl md:text-3xl font-semibold">Attraction Not Found</h2>
          <p className="text-muted-foreground">
            The attraction you're looking for doesn't exist or has been removed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
          <Link href="/properties">
            <Button variant="outline" className="gap-2">
              <Search className="h-4 w-4" />
              Browse Attractions
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
