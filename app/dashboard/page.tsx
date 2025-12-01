import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, ArrowLeft, Heart, Star, User, Settings } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user's bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      *,
      properties (
        title,
        city,
        country,
        images,
        users!properties_host_id_fkey (full_name)
      )
    `)
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false })

  // Get user's favorites
  const { data: favorites } = await supabase
    .from("favorites")
    .select(`
      *,
      properties (
        id,
        title,
        city,
        country,
        price_per_night,
        images,
        rating
      )
    `)
    .eq("user_id", user.id)

  // Get user profile
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", user.id).single()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default"
      case "pending":
        return "secondary"
      case "cancelled":
        return "destructive"
      case "completed":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-medium">{userProfile?.full_name || user.email}</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your bookings and account</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link href="/attractions">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Browse Properties</CardTitle>
                <CardDescription>Find your next perfect getaway</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/host">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Become a Host</CardTitle>
                <CardDescription>Start earning by hosting guests</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/favorites">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Heart className="h-4 w-4" />
                  <span>Favorites</span>
                </CardTitle>
                <CardDescription>{favorites?.length || 0} saved properties</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/profile">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Profile</span>
                </CardTitle>
                <CardDescription>Manage your account</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Bookings */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>My Bookings</CardTitle>
                <CardDescription>
                  {bookings?.length === 0
                    ? "No bookings yet"
                    : `${bookings?.length} booking${bookings?.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!bookings || bookings.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start exploring amazing places and make your first booking
                    </p>
                    <Link href="/attractions">
                      <Button>Browse Properties</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.slice(0, 3).map((booking: any) => (
                      <Card key={booking.id}>
                        <CardContent className="p-4">
                          <div className="flex space-x-4">
                            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                              {Array.isArray(booking.properties.images) && booking.properties.images.length > 0 ? (
                                <img
                                  src={booking.properties.images[0] || "/placeholder.svg?height=80&width=80"}
                                  alt={booking.properties.title || 'Property'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <MapPin className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold">{booking.properties.title}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {booking.properties.city}, {booking.properties.country}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Host: {booking.properties.users.full_name}
                                  </p>
                                </div>
                                <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">Check-in</div>
                                  <div className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Total</div>
                                  <div className="font-medium">${booking.total_price}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {bookings.length > 3 && (
                      <div className="text-center pt-4">
                        <Link href="/dashboard/bookings">
                          <Button variant="outline">View All Bookings</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Favorites Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="h-4 w-4" />
                  <span>Favorites</span>
                </CardTitle>
                <CardDescription>{favorites?.length || 0} saved properties</CardDescription>
              </CardHeader>
              <CardContent>
                {!favorites || favorites.length === 0 ? (
                  <div className="text-center py-4">
                    <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No favorites yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {favorites.slice(0, 2).map((favorite: any) => (
                      <div key={favorite.id} className="flex space-x-3">
                        <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                          <img
                            src={favorite.properties.images?.[0] || "/placeholder.svg?height=48&width=48"}
                            alt={favorite.properties.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{favorite.properties.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {favorite.properties.city}, {favorite.properties.country}
                          </p>
                          <div className="flex items-center space-x-1 mt-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs">{favorite.properties.rating || "New"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {favorites.length > 2 && (
                      <Link href="/dashboard/favorites">
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          View All
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Bookings</span>
                  <span className="font-medium">{bookings?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Saved Properties</span>
                  <span className="font-medium">{favorites?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="font-medium">
                    {userProfile?.created_at
                      ? new Date(userProfile.created_at).getFullYear()
                      : new Date().getFullYear()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
