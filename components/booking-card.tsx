"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Star, Users, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { createBooking } from "@/lib/booking-actions"
import { createClient } from "@/lib/supabase/client"
import type { DateRange } from "react-day-picker"

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [guests, setGuests] = useState("1")
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [availabilityMessage, setAvailabilityMessage] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [user, setUser] = useState<any>(null)
  const [bookedDates, setBookedDates] = useState<Date[]>([])
  const [isLoadingDates, setIsLoadingDates] = useState(true)

  const [state, formAction] = useActionState(createBooking, null)

  // Today's date for calendar
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Fetch booked dates for this property
  useEffect(() => {
    const fetchBookedDates = async () => {
      setIsLoadingDates(true)
      try {
        const response = await fetch(`/api/booked-dates?propertyId=${propertyId}`)
        const data = await response.json()
        
        if (data.bookedDates) {
          // Convert date strings to Date objects
          const dates = data.bookedDates.map((dateStr: string) => new Date(dateStr + "T00:00:00"))
          setBookedDates(dates)
        }
      } catch (error) {
        console.error("Error fetching booked dates:", error)
      } finally {
        setIsLoadingDates(false)
      }
    }

    fetchBookedDates()
  }, [propertyId])

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

  // Get checkIn and checkOut from dateRange
  const checkIn = dateRange?.from ? dateRange.from.toISOString().split("T")[0] : ""
  const checkOut = dateRange?.to ? dateRange.to.toISOString().split("T")[0] : ""

  const calculateNights = () => {
    if (!dateRange?.from || !dateRange?.to) return 0
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
          message: "Great! This property is available for your selected dates.",
        })
      } else {
        setAvailabilityMessage({
          type: "error",
          message: result.error || "Property is not available for the selected dates.",
        })
      }
    } catch (error) {
      setAvailabilityMessage({
        type: "error",
        message: "Error checking availability. Please try again.",
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

  // Check if a date should be disabled (past dates or booked dates)
  const isDateDisabled = (date: Date) => {
    // Disable past dates
    if (date < today) return true
    
    // Check if the date is in booked dates
    return bookedDates.some(
      (bookedDate) => 
        bookedDate.getFullYear() === date.getFullYear() &&
        bookedDate.getMonth() === date.getMonth() &&
        bookedDate.getDate() === date.getDate()
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">${pricePerNight}</span>
            <span className="text-muted-foreground"> / night</span>
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
              You need to{" "}
              <button onClick={() => router.push("/auth/login")} className="underline font-medium hover:no-underline">
                log in
              </button>{" "}
              to make a booking.
            </AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="totalPrice" value={total.toFixed(2)} />
          <input type="hidden" name="checkIn" value={checkIn} />
          <input type="hidden" name="checkOut" value={checkOut} />

          {/* Calendar Date Picker */}
          <div>
            <Label className="text-xs font-medium mb-2 block">SELECT DATES</Label>
            {isLoadingDates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading availability...</span>
              </div>
            ) : (
              <>
                <div className="flex justify-center border rounded-md p-2">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={isDateDisabled}
                    numberOfMonths={1}
                    className="rounded-md"
                  />
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-primary"></div>
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-muted opacity-50"></div>
                    <span>Unavailable</span>
                  </div>
                </div>
                {/* Selected dates display */}
                {dateRange?.from && (
                  <div className="mt-3 p-2 bg-muted rounded-md text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in:</span>
                      <span className="font-medium">{dateRange.from.toLocaleDateString()}</span>
                    </div>
                    {dateRange.to && (
                      <div className="flex justify-between mt-1">
                        <span className="text-muted-foreground">Check-out:</span>
                        <span className="font-medium">{dateRange.to.toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Guests Selector */}
          <div>
            <Label htmlFor="guests" className="text-xs font-medium">
              GUESTS
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
                      {num} guest{num !== 1 ? "s" : ""}
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
              <span>Checking availability...</span>
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
            {!user ? "Log in to Reserve" : isCheckingAvailability ? "Checking..." : "Reserve"}
          </Button>

          {user && isFormValid && <p className="text-center text-sm text-muted-foreground">You won't be charged yet</p>}
        </form>

        {/* Price Breakdown */}
        {nights > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>
                ${pricePerNight} × {nights} nights
              </span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Cleaning fee</span>
              <span>${cleaningFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Service fee</span>
              <span>${serviceFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
