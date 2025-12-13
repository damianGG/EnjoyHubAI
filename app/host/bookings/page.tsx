import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, User, MapPin } from "lucide-react"
import Link from "next/link"
import { BookingApprovalActions } from "@/components/booking-approval-actions"

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

  // Get all property bookings for this host's properties
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      *,
      properties (title, city, country),
      users!bookings_guest_id_fkey (full_name, email)
    `)
    .in(
      "property_id",
      await supabase
        .from("properties")
        .select("id")
        .eq("host_id", user.id)
        .then(({ data }) => data?.map((p) => p.id) || []),
    )
    .order("created_at", { ascending: false })

  // Get all offer bookings for this host's properties
  const { data: offerBookings } = await supabase
    .from("offer_bookings")
    .select(`
      *,
      offers (
        id,
        title
      ),
      properties!offer_bookings_place_id_fkey (
        id,
        title,
        host_id
      )
    `)
    .eq("properties.host_id", user.id)
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

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-")
    return `${day}.${month}.${year}`
  }

  // Separate pending and non-pending offer bookings
  const pendingOfferBookings = offerBookings?.filter((b: any) => b.status === "pending") || []
  const otherOfferBookings = offerBookings?.filter((b: any) => b.status !== "pending") || []
  const allBookings = bookings || []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/host" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Powrót do Panelu
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Rezerwacje</h1>
          <p className="text-muted-foreground">Zarządzaj rezerwacjami dla Twoich obiektów</p>
        </div>

        {/* Pending Offer Bookings - Priority Section */}
        {pendingOfferBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
              <Calendar className="h-6 w-6 mr-2 text-orange-500" />
              Oczekujące na Zatwierdzenie ({pendingOfferBookings.length})
            </h2>
            <div className="space-y-4">
              {pendingOfferBookings.map((booking: any) => (
                <Card key={booking.id} className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{booking.offers?.title || "Unknown Offer"}</span>
                      </CardTitle>
                      <Badge variant="secondary" className="bg-orange-100">Oczekuje</Badge>
                    </div>
                    <CardDescription>
                      {booking.properties?.title || "Unknown Property"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{booking.customer_name}</div>
                          <div className="text-sm text-muted-foreground">{booking.customer_email}</div>
                          {booking.customer_phone && (
                            <div className="text-sm text-muted-foreground">{booking.customer_phone}</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Data</div>
                        <div className="font-medium">{formatDate(booking.booking_date)}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Godzina</div>
                        <div className="font-medium">{booking.start_time} - {booking.end_time}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Liczba osób</div>
                        <div className="font-medium">{booking.persons}</div>
                      </div>
                    </div>

                    <BookingApprovalActions bookingId={booking.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed/Other Offer Bookings */}
        {otherOfferBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Rezerwacje Ofert</h2>
            <div className="space-y-4">
              {otherOfferBookings.map((booking: any) => (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{booking.offers?.title || "Unknown Offer"}</span>
                      </CardTitle>
                      <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                    </div>
                    <CardDescription>
                      {booking.properties?.title || "Unknown Property"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{booking.customer_name}</div>
                          <div className="text-sm text-muted-foreground">{booking.customer_email}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Data</div>
                        <div className="font-medium">{formatDate(booking.booking_date)}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Godzina</div>
                        <div className="font-medium">{booking.start_time} - {booking.end_time}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Liczba osób</div>
                        <div className="font-medium">{booking.persons}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Property Bookings */}
        {allBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Rezerwacje Nieruchomości</h2>
            <div className="space-y-4">
              {allBookings.map((booking: any) => (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{booking.properties?.title || 'Untitled Property'}</span>
                      </CardTitle>
                      <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                    </div>
                    <CardDescription>
                      {booking.properties?.city || 'Unknown'}, {booking.properties?.country || 'Unknown'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{booking.users?.full_name}</div>
                          <div className="text-sm text-muted-foreground">{booking.users?.email}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Check-in</div>
                        <div className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Check-out</div>
                        <div className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Total</div>
                        <div className="font-medium">${booking.total_price}</div>
                        <div className="text-sm text-muted-foreground">
                          {booking.guests_count} guest{booking.guests_count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {allBookings.length === 0 && otherOfferBookings.length === 0 && pendingOfferBookings.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Brak rezerwacji</h3>
              <p className="text-muted-foreground">
                Rezerwacje pojawią się tutaj, gdy goście zaczną rezerwować Twoje obiekty
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
