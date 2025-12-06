import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, MapPin, Users, Clock, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface BookingConfirmationPageProps {
  params: Promise<{
    id: string
  }>
}

function formatDisplayDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  const [year, month, day] = dateStr.split("-")
  return `${day}.${month}.${year}`
}

export default async function OfferBookingConfirmationPage({ params }: BookingConfirmationPageProps) {
  const resolvedParams = await params
  
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = await createClient()

  // Get booking details
  const { data: booking, error: bookingError } = await supabase
    .from("offer_bookings")
    .select(`
      *,
      offers (
        title,
        base_price,
        currency,
        duration_minutes
      ),
      properties (
        title,
        city,
        country,
        address
      )
    `)
    .eq("id", resolvedParams.id)
    .single()

  if (bookingError) {
    console.error("Error fetching booking:", bookingError)
  }

  if (!booking || !booking.offers || !booking.properties) {
    notFound()
  }

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

  const totalPrice = booking.persons * booking.offers.base_price

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
            Twoja rezerwacja została pomyślnie utworzona. Otrzymasz wiadomość e-mail z potwierdzeniem.
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
              <h3 className="font-semibold text-lg mb-2">{booking.offers.title}</h3>
              <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <div>
                  <p>{booking.properties.title}</p>
                  <p>{booking.properties.city}, {booking.properties.country}</p>
                </div>
              </div>
            </div>

            {/* Booking Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Data</div>
                  <div className="text-sm text-muted-foreground">{formatDisplayDate(booking.booking_date)}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Godzina</div>
                  <div className="text-sm text-muted-foreground">{booking.start_time} - {booking.end_time}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Liczba osób</div>
                  <div className="text-sm text-muted-foreground">
                    {booking.persons} {booking.persons === 1 ? "osoba" : booking.persons < 5 ? "osoby" : "osób"}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Czas trwania</div>
                  <div className="text-sm text-muted-foreground">{booking.offers.duration_minutes} min</div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Dane kontaktowe</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Imię i nazwisko:</span>
                  <span className="font-medium">{booking.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-medium">{booking.customer_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefon:</span>
                  <span className="font-medium">{booking.customer_phone}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Podsumowanie płatności</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{booking.persons} {booking.persons === 1 ? "osoba" : booking.persons < 5 ? "osoby" : "osób"} × {booking.offers.base_price} {booking.offers.currency}</span>
                <span>{totalPrice} {booking.offers.currency}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Razem do zapłaty</span>
                <span>{totalPrice} {booking.offers.currency}</span>
              </div>
              <div className="text-sm text-muted-foreground pt-2">
                Płatność na miejscu
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Następne kroki</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <div className="font-medium">Potwierdzenie e-mailem</div>
                <div className="text-sm text-muted-foreground">
                  Otrzymasz wiadomość e-mail z potwierdzeniem i wszystkimi szczegółami
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <div className="font-medium">Przybycie na miejsce</div>
                <div className="text-sm text-muted-foreground">
                  Prosimy o przybycie 10 minut przed zarezerwowaną godziną
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <div className="font-medium">Ciesz się atrakcją!</div>
                <div className="text-sm text-muted-foreground">Życzymy wspaniałych wrażeń!</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/attractions" className="flex-1">
            <Button className="w-full">Wróć do atrakcji</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
