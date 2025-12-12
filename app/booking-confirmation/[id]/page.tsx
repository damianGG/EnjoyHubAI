import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, MapPin, Users, CreditCard, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface BookingConfirmationPageProps {
  params: Promise<{
    id: string
  }> | {
    id: string
  }
}

export default async function BookingConfirmationPage({ params }: BookingConfirmationPageProps) {
  // Handle async params for Next.js 15
  const resolvedParams = await Promise.resolve(params)
  
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

  // Get booking details
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(`
      *,
      properties (
        title,
        city,
        country,
        images,
        address,
        users!properties_host_id_fkey (full_name, email)
      )
    `)
    .eq("id", resolvedParams.id)
    .eq("guest_id", user.id)
    .single()

  if (bookingError) {
    console.error("Error fetching booking:", bookingError)
  }

  if (!booking || !booking.properties) {
    notFound()
  }

  const checkInDate = new Date(booking.check_in)
  const checkOutDate = new Date(booking.check_out)
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default"
      case "pending":
        return "secondary"
      case "cancelled":
        return "destructive"
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
            Powrót do strony głównej
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your reservation has been successfully created. You'll receive a confirmation email shortly.
          </p>
        </div>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Booking Details</CardTitle>
              <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
            </div>
            <CardDescription>Booking ID: {booking.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Property Info */}
            <div className="flex space-x-4">
              <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                {Array.isArray(booking.properties?.images) && booking.properties.images.length > 0 ? (
                  <img
                    src={booking.properties.images[0] || "/placeholder.svg?height=80&width=80"}
                    alt={booking.properties?.title || 'Property'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{booking.properties?.title || 'Property'}</h3>
                <p className="text-sm text-muted-foreground">
                  {booking.properties?.city || 'N/A'}, {booking.properties?.country || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Host: {booking.properties?.users?.full_name || 'Host'}</p>
              </div>
            </div>

            {/* Booking Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Check-in</div>
                  <div className="text-sm text-muted-foreground">{checkInDate.toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Check-out</div>
                  <div className="text-sm text-muted-foreground">{checkOutDate.toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Guests</div>
                  <div className="text-sm text-muted-foreground">
                    {booking.guests_count} guest{booking.guests_count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{nights} nights</span>
                <span>${(booking.total_price * 0.8).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Cleaning fee</span>
                <span>$25.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Service fee</span>
                <span>${(booking.total_price * 0.1).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>${booking.total_price}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <div className="font-medium">Confirmation Email</div>
                <div className="text-sm text-muted-foreground">
                  You'll receive a confirmation email with all the details
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <div className="font-medium">Host Contact</div>
                <div className="text-sm text-muted-foreground">
                  Your host will contact you with check-in instructions
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <div className="font-medium">Enjoy Your Stay</div>
                <div className="text-sm text-muted-foreground">Have a wonderful time at your destination!</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full bg-transparent">
              View My Bookings
            </Button>
          </Link>
          <Link href="/" className="flex-1">
            <Button className="w-full">Zarezerwuj kolejny pobyt</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
