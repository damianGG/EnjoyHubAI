"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Star, Users, Loader2, Calendar, AlertCircle, CheckCircle } from "lucide-react"
import { createBooking } from "@/lib/booking-actions"
import { createClient } from "@/lib/supabase/client"

interface BookingCardProps {
  propertyId: string
  pricePerNight: number
  maxGuests: number
  avgRating: number
  reviewCount: number
}

export default function BookingCard({
  propertyId,
  pricePerNight,
  maxGuests,
  avgRating,
  reviewCount,
}: BookingCardProps) {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [guests, setGuests] = useState("1")
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [availabilityMessage, setAvailabilityMessage] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [user, setUser] = useState<any>(null)

  const [state, formAction] = useActionState(createBooking, null)

  // Check if user is logged in and listen for auth state changes
  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Handle successful booking
  useEffect(() => {
    if (state?.success) {
      router.push(`/booking-confirmation/${state.bookingId}`)
    }
  }, [state, router])

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const checkAvailability = async () => {
    if (!checkIn || !checkOut) return

    setIsCheckingAvailability(true)
    setAvailabilityMessage(null)

    try {
      const response = await fetch("/api/check-availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId,
          checkIn,
          checkOut,
        }),
      })

      const result = await response.json()

      if (result.available) {
        setAvailabilityMessage({
          type: "success",
          message: "Świetnie! Ten obiekt jest dostępny w wybranym terminie.",
        })
      } else {
        setAvailabilityMessage({
          type: "error",
          message: result.error || "Obiekt jest niedostępny w wybranym terminie.",
        })
      }
    } catch (error) {
      setAvailabilityMessage({
        type: "error",
        message: "Błąd podczas sprawdzania dostępności. Spróbuj ponownie.",
      })
    } finally {
      setIsCheckingAvailability(false)
    }
  }

  // Auto-check availability when dates change
  useEffect(() => {
    if (checkIn && checkOut) {
      const timeoutId = setTimeout(() => {
        checkAvailability()
      }, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setAvailabilityMessage(null)
    }
  }, [checkIn, checkOut])

  const nights = calculateNights()
  const subtotal = nights * pricePerNight
  const serviceFee = subtotal * 0.1 // 10% service fee
  const cleaningFee = 25 // Fixed cleaning fee
  const total = subtotal + serviceFee + cleaningFee

  const isFormValid = checkIn && checkOut && guests && nights > 0
  const isAvailable = availabilityMessage?.type === "success"

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0]

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">{pricePerNight} zł</span>
            <span className="text-muted-foreground"> / noc</span>
          </div>
          {avgRating > 0 && (
            <div className="flex items-center space-x-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{avgRating}</span>
              <span className="text-muted-foreground">({reviewCount})</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!user && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Musisz się{" "}
              <button onClick={() => router.push("/auth/login")} className="underline font-medium hover:no-underline">
                zalogować
              </button>
              , aby dokonać rezerwacji.
            </AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="totalPrice" value={total.toFixed(2)} />

          {/* Date Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="checkin" className="text-xs font-medium">
                ZAMELDOWANIE
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="checkin"
                  name="checkIn"
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="pl-10 text-sm"
                  disabled={!user}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="checkout" className="text-xs font-medium">
                WYMELDOWANIE
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="checkout"
                  name="checkOut"
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="pl-10 text-sm"
                  disabled={!user}
                />
              </div>
            </div>
          </div>

          {/* Guests Selector */}
          <div>
            <Label htmlFor="guests" className="text-xs font-medium">
              GOŚCIE
            </Label>
            <Select name="guests" value={guests} onValueChange={setGuests} disabled={!user}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxGuests }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      {num} {num === 1 ? "gość" : "gości"}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Availability Check */}
          {isCheckingAvailability && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sprawdzanie dostępności...</span>
            </div>
          )}

          {availabilityMessage && (
            <Alert variant={availabilityMessage.type === "error" ? "destructive" : "default"}>
              {availabilityMessage.type === "success" ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{availabilityMessage.message}</AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Reserve Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!user || !isFormValid || !isAvailable || isCheckingAvailability}
          >
            {!user ? "Zaloguj się, aby zarezerwować" : isCheckingAvailability ? "Sprawdzanie..." : "Zarezerwuj"}
          </Button>

          {user && isFormValid && <p className="text-center text-sm text-muted-foreground">Nie zostaniesz jeszcze obciążony</p>}
        </form>

        {/* Price Breakdown */}
        {nights > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>
                {pricePerNight} zł × {nights} {nights === 1 ? "noc" : "nocy"}
              </span>
              <span>{subtotal.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Opłata za sprzątanie</span>
              <span>{cleaningFee.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Opłata serwisowa</span>
              <span>{serviceFee.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Razem</span>
              <span>{total.toFixed(2)} zł</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
