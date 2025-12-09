import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, MapPin, Users, Clock, ArrowLeft, Phone } from "lucide-react"
import Link from "next/link"
import { formatDisplayDate } from "@/lib/utils"
import SendSMSCard from "@/components/send-sms-card"

interface BookingConfirmationPageProps {
  params: Promise<{
    id: string
  }> | {
    id: string
  }
}

export default async function OfferBookingConfirmationPage({ params }: BookingConfirmationPageProps) {
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

  // Get booking details with offer and property information
  const { data: booking, error: bookingError } = await supabase
    .from("offer_bookings")
    .select(`
      *,
      offers (
        id,
        title,
        description,
        base_price,
        currency,
        duration_minutes,
        properties (
          id,
          title,
          city,
          country,
          address,
          images,
          users!properties_host_id_fkey (full_name, email, phone)
        )
      )
    `)
    .eq("id", resolvedParams.id)
    .single()

  if (bookingError) {
    console.error("Error fetching booking:", bookingError)
  }

  if (!booking || !booking.offers) {
    notFound()
  }

  const offer = booking.offers
  const property = offer.properties

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

  const formatTime = (time: string) => {
    // Time is in format HH:MM:SS, we only need HH:MM
    return time.substring(0, 5)
  }

  const totalPrice = booking.persons * offer.base_price

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/attractions" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm sm:text-base">Powrót do atrakcji</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Rezerwacja potwierdzona!</h1>
          <p className="text-muted-foreground">
            Twoja rezerwacja została pomyślnie utworzona. Prosimy o przybycie 10 minut przed zarezerwowaną godziną.
          </p>
        </div>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Szczegóły rezerwacji</CardTitle>
              <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
            </div>
            <CardDescription>ID rezerwacji: {booking.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Offer Info */}
            <div>
              <h3 className="font-semibold text-lg mb-2">{offer.title}</h3>
              {property && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{property.title}</p>
                    {property.address && <p>{property.address}</p>}
                    <p>{property.city}, {property.country}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Data</div>
                  <div className="text-base">{formatDisplayDate(booking.booking_date)}</div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Godzina</div>
                  <div className="text-base">{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Liczba osób</div>
                  <div className="text-base">
                    {booking.persons} {booking.persons === 1 ? "osoba" : booking.persons < 5 ? "osoby" : "osób"}
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Telefon</div>
                  <div className="text-base">{booking.customer_phone || "Nie podano"}</div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Dane kontaktowe</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Imię i nazwisko:</span> {booking.customer_name}</p>
                <p><span className="text-muted-foreground">E-mail:</span> {booking.customer_email}</p>
                {booking.customer_phone && (
                  <p><span className="text-muted-foreground">Telefon:</span> {booking.customer_phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              Podsumowanie płatności
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{offer.title}</span>
                <span>{offer.base_price} {offer.currency} / os.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Liczba osób</span>
                <span>{booking.persons}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Do zapłaty na miejscu</span>
                <span>{totalPrice} {offer.currency}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Co dalej?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <div className="font-medium">Potwierdzenie e-mail</div>
                <div className="text-sm text-muted-foreground">
                  Otrzymasz wiadomość e-mail z potwierdzeniem rezerwacji na adres {booking.customer_email}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <div className="font-medium">Przypomnienie SMS</div>
                <div className="text-sm text-muted-foreground">
                  Możesz otrzymać przypomnienie SMS dzień przed rezerwacją
                  {booking.customer_phone && ` na numer ${booking.customer_phone}`}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <div className="font-medium">Przybycie na miejsce</div>
                <div className="text-sm text-muted-foreground">
                  Prosimy o przybycie 10 minut przed zarezerwowaną godziną. Płatność na miejscu.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Send to Phone Section */}
        {booking.customer_phone && (
          <SendSMSCard 
            bookingId={booking.id} 
            customerPhone={booking.customer_phone}
          />
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/attractions" className="flex-1">
            <Button variant="outline" className="w-full bg-transparent">
              Wróć do atrakcji
            </Button>
          </Link>
          {property && (
            <Link href={`/offers/${offer.id}`} className="flex-1">
              <Button className="w-full">Zarezerwuj ponownie</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
