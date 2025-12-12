import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowLeft, MapPin, Star } from "lucide-react"
import Link from "next/link"

export default async function BookingsPage() {
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

  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      *,
      properties (
        id,
        title,
        city,
        country,
        images,
        users!properties_host_id_fkey (full_name)
      )
    `)
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false })

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

  const upcomingBookings =
    bookings?.filter((booking) => new Date(booking.check_in) > new Date() && booking.status === "confirmed") || []

  const pastBookings =
    bookings?.filter((booking) => new Date(booking.check_out) < new Date() || booking.status === "completed") || []

  const pendingBookings = bookings?.filter((booking) => booking.status === "pending") || []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center space-x-2">
            <Calendar className="h-8 w-8" />
            <span>My Bookings</span>
          </h1>
          <p className="text-muted-foreground">
            {bookings?.length === 0
              ? "No bookings yet"
              : `${bookings?.length} total booking${bookings?.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {!bookings || bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Brak rezerwacji</h3>
              <p className="text-muted-foreground mb-6">Zacznij odkrywać niesamowite miejsca i dokonaj swojej pierwszej rezerwacji</p>
              <Link href="/">
                <Button>Przeglądaj atrakcje</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Pending Bookings */}
            {pendingBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Pending Confirmation</h2>
                <div className="space-y-4">
                  {pendingBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Upcoming Trips</h2>
                <div className="space-y-4">
                  {upcomingBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}

            {/* Past Bookings */}
            {pastBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Past Trips</h2>
                <div className="space-y-4">
                  {pastBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BookingCard({ booking }: { booking: any }) {
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

  const isUpcoming = new Date(booking.check_in) > new Date()
  const isPast = new Date(booking.check_out) < new Date()

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex space-x-6">
          <div className="w-32 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {Array.isArray(booking.properties?.images) && booking.properties.images.length > 0 ? (
              <img
                src={booking.properties.images[0] || "/placeholder.svg?height=96&width=128"}
                alt={booking.properties?.title || 'Property'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">{booking.properties?.title || 'Untitled Property'}</h3>
                <p className="text-muted-foreground mb-2">
                  {booking.properties?.city || 'Unknown'}, {booking.properties?.country || 'Unknown'}
                </p>
                <p className="text-sm text-muted-foreground">Host: {booking.properties?.users?.full_name || 'Unknown'}</p>
              </div>
              <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Check-in</div>
                <div className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Check-out</div>
                <div className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Guests</div>
                <div className="font-medium">
                  {booking.guests_count} guest{booking.guests_count !== 1 ? "s" : ""}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="font-medium text-lg">${booking.total_price}</div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Link href={`/properties/${booking.properties?.id || booking.property_id}`}>
                <Button variant="outline" size="sm">
                  View Property
                </Button>
              </Link>
              {isPast && booking.status === "completed" && (
                <Button variant="outline" size="sm">
                  <Star className="h-4 w-4 mr-1" />
                  Write Review
                </Button>
              )}
              {booking.status === "pending" && (
                <Button variant="destructive" size="sm">
                  Cancel Request
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
