import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import PropertiesView from "@/components/properties-view"

export default async function PropertiesPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()

  // Get all active properties with their average ratings
  const { data: properties } = await supabase
    .from("properties")
    .select(`
      *,
      users!properties_host_id_fkey (full_name),
      reviews (rating)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  // Calculate average ratings
  const propertiesWithRatings = properties?.map((property) => {
    const ratings = property.reviews?.map((r: any) => r.rating) || []
    const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
    return {
      ...property,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: ratings.length,
    }
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">E</span>
            </div>
            <span className="text-xl font-bold">EnjoyHub</span>
          </Link>

          <nav className="flex items-center space-x-4">
            <Link href="/auth/login" className="text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Link href="/auth/sign-up">
              <Button>Sign up</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Discover Amazing Places</h1>
          <p className="text-muted-foreground">Find the perfect place for your next getaway</p>
        </div>

        {!propertiesWithRatings || propertiesWithRatings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No properties available</h3>
              <p className="text-muted-foreground">Check back later for new listings</p>
            </CardContent>
          </Card>
        ) : (
          <PropertiesView properties={propertiesWithRatings} />
        )}
      </div>
    </div>
  )
}
