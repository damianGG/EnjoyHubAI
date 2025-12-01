import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, User, MapPin } from "lucide-react"
import Link from "next/link"

export default async function BookingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get all bookings for this host's properties
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
          <div className="flex items-center space-x-4">
            <Link href="/host" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Bookings</h1>
          <p className="text-muted-foreground">Manage reservations for your properties</p>
        </div>

        {!bookings || bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
              <p className="text-muted-foreground">
                Bookings will appear here once guests start reserving your properties
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking: any) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>{booking.properties?.title}</span>
                    </CardTitle>
                    <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                  </div>
                  <CardDescription>
                    {booking.properties?.city}, {booking.properties?.country}
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
        )}
      </div>
    </div>
  )
}
