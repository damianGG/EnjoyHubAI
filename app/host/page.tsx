import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Home, Calendar, BarChart3, Users } from "lucide-react"
import Link from "next/link"

export default async function HostDashboard() {
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

  // Get user profile to check if they're a host
  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single()

  // Get host statistics
  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, is_active, price_per_night")
    .eq("host_id", user.id)

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, total_price, property_id")
    .in("property_id", properties?.map((p) => p.id) || [])

  const totalProperties = properties?.length || 0
  const activeProperties = properties?.filter((p) => p.is_active)?.length || 0
  const totalBookings = bookings?.length || 0
  const totalRevenue = bookings?.reduce((sum, booking) => sum + (booking.total_price || 0), 0) || 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">E</span>
              </div>
              <span className="text-xl font-bold">EnjoyHub</span>
            </Link>
          </div>

          <nav className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Welcome, {profile?.full_name}</span>
            <Link href="/host/properties/new" className="flex-1 sm:flex-initial">
              <Button className="w-full sm:w-auto" size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="ml-2 sm:ml-0">Add Property</span>
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Host Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your properties and bookings</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProperties}</div>
              <p className="text-xs text-muted-foreground">{activeProperties} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBookings}</div>
              <p className="text-xs text-muted-foreground">All time bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalProperties > 0 ? Math.round((totalBookings / totalProperties) * 10) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Average occupancy</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <Link href="/host/properties/new">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Add New Property
                </CardTitle>
                <CardDescription>List a new property on EnjoyHub</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <Link href="/host/properties">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Home className="h-5 w-5 mr-2" />
                  Manage Properties
                </CardTitle>
                <CardDescription>View and edit your existing properties</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <Link href="/host/bookings">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  View Bookings
                </CardTitle>
                <CardDescription>Manage reservations and calendar</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>

        {/* Recent Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Your Properties</CardTitle>
            <CardDescription>
              {totalProperties === 0 ? "No properties yet" : `${totalProperties} properties listed`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalProperties === 0 ? (
              <div className="text-center py-8">
                <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
                <p className="text-muted-foreground mb-4">Start earning by listing your first property</p>
                <Link href="/host/properties/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Property
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {properties?.slice(0, 5).map((property) => (
                  <div key={property.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-semibold">{property.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        ${property.price_per_night}/night • {property.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <Link href={`/host/properties/${property.id}`}>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </Link>
                  </div>
                ))}
                {properties && properties.length > 5 && (
                  <div className="text-center pt-4">
                    <Link href="/host/properties">
                      <Button variant="outline">View All Properties</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
