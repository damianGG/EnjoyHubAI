"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Star, Users, Loader2, AlertCircle, CheckCircle, Calendar as CalendarIcon } from "lucide-react"
import { createBooking } from "@/lib/booking-actions"
import { createClient } from "@/lib/supabase/client"
import type { AvailabilityCalendar, DateAvailability } from "@/lib/types/dynamic-fields"
import { addDays, format, differenceInDays } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface AvailabilityCalendarProps {
  propertyId: string
  pricePerNight: number
  maxGuests: number
  avgRating: number
  reviewCount: number
}

export default function AvailabilityCalendarCard({
  propertyId,
  pricePerNight,
  maxGuests,
  avgRating,
  reviewCount,
}: AvailabilityCalendarProps) {
  const router = useRouter()
  const [checkInDate, setCheckInDate] = useState<Date | undefined>()
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>()
  const [guests, setGuests] = useState("1")
  const [user, setUser] = useState<any>(null)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [availability, setAvailability] = useState<AvailabilityCalendar | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [dateAvailabilityMap, setDateAvailabilityMap] = useState<Map<string, DateAvailability>>(new Map())

  const [state, formAction] = useActionState(createBooking, null)

  // Check if user is logged in
  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        
        if (error) {
          console.error("Error fetching user:", error)
        }
        
        console.log("Auth check - user:", user ? "logged in" : "not logged in")
        setUser(user)
      } catch (err) {
        console.error("Exception in getUser:", err)
        setUser(null)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed - event:", _event, "session:", session ? "exists" : "null")
      setUser(session?.user ?? null)
      setIsLoadingAuth(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Load availability data
  useEffect(() => {
    const loadAvailability = async () => {
      setIsLoadingAvailability(true)
      try {
        const now = new Date()
        const threeMonthsLater = addDays(now, 90)
        
        const response = await fetch(
          `/api/attractions/${propertyId}/availability?start_date=${format(now, "yyyy-MM-dd")}&end_date=${format(threeMonthsLater, "yyyy-MM-dd")}`
        )
        
        if (response.ok) {
          const data: AvailabilityCalendar = await response.json()
          setAvailability(data)
          
          // Create a map for quick date lookups
          const dateMap = new Map<string, DateAvailability>()
          data.dates.forEach(dateInfo => {
            dateMap.set(dateInfo.date, dateInfo)
          })
          setDateAvailabilityMap(dateMap)
        }
      } catch (error) {
        console.error("Failed to load availability:", error)
      } finally {
        setIsLoadingAvailability(false)
      }
    }

    loadAvailability()
  }, [propertyId])

  // Handle successful booking
  useEffect(() => {
    if (state?.success) {
      router.push(`/booking-confirmation/${state.bookingId}`)
    }
  }, [state, router])

  // Custom date matcher for the calendar
  const isDateAvailable = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dateInfo = dateAvailabilityMap.get(dateStr)
    return dateInfo?.available ?? false
  }

  const isDateBlocked = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dateInfo = dateAvailabilityMap.get(dateStr)
    return dateInfo?.isBlocked ?? false
  }

  const getDatePrice = (date: Date): number => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dateInfo = dateAvailabilityMap.get(dateStr)
    return dateInfo?.price ?? pricePerNight
  }

  // Calculate total based on selected dates
  const calculateTotal = () => {
    if (!checkInDate || !checkOutDate) return { nights: 0, subtotal: 0, total: 0 }

    const nights = differenceInDays(checkOutDate, checkInDate)
    let subtotal = 0

    // Calculate price for each night
    const current = new Date(checkInDate)
    for (let i = 0; i < nights; i++) {
      subtotal += getDatePrice(current)
      current.setDate(current.getDate() + 1)
    }

    const serviceFee = subtotal * 0.1 // 10% service fee
    const cleaningFee = 25 // Fixed cleaning fee
    const total = subtotal + serviceFee + cleaningFee

    return { nights, subtotal, serviceFee, cleaningFee, total }
  }

  const { nights, subtotal, serviceFee, cleaningFee, total } = calculateTotal()

  // Check if selected range is valid
  const isRangeValid = () => {
    if (!checkInDate || !checkOutDate || !availability) return false

    const minStay = availability.min_stay || 1
    const maxStay = availability.max_stay

    if (nights < minStay) return false
    if (maxStay && nights > maxStay) return false

    // Check all dates in range are available
    const current = new Date(checkInDate)
    while (current < checkOutDate) {
      if (!isDateAvailable(current)) return false
      current.setDate(current.getDate() + 1)
    }

    return true
  }

  const isFormValid = checkInDate && checkOutDate && guests && isRangeValid()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
        {/* Debug info - can be removed later */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs bg-muted p-2 rounded">
            Auth Status: {isLoadingAuth ? "Loading..." : user ? `Logged in as ${user.email}` : "Not logged in"}
          </div>
        )}

        {/* Show loading state while checking authentication */}
        {isLoadingAuth && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Checking authentication...</span>
          </div>
        )}

        {/* Show login alert only after auth check is complete and user is not logged in */}
        {!isLoadingAuth && !user && (
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

        {isLoadingAvailability && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoadingAvailability && availability && (
          <>
            {/* Availability Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Booking Mode:</span>
              <Badge variant="secondary">{availability.booking_mode}</Badge>
            </div>

            {availability.min_stay > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minimum stay:</span>
                <Badge variant="outline">{availability.min_stay} nights</Badge>
              </div>
            )}

            {/* Calendar */}
            <div className="border rounded-md p-3">
              <Calendar
                mode="range"
                selected={{ from: checkInDate, to: checkOutDate }}
                onSelect={(range) => {
                  setCheckInDate(range?.from)
                  setCheckOutDate(range?.to)
                }}
                disabled={(date) => date < today || !isDateAvailable(date)}
                className="rounded-md"
                numberOfMonths={1}
              />
            </div>

            {/* Selected Dates Display */}
            {checkInDate && checkOutDate && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Check-in:</span>
                  <span className="font-medium">{format(checkInDate, "PPP")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Check-out:</span>
                  <span className="font-medium">{format(checkOutDate, "PPP")}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Nights:</span>
                  <span>{nights}</span>
                </div>
              </div>
            )}

            {/* Guest Selector */}
            <div>
              <Label htmlFor="guests" className="text-xs font-medium">
                GUESTS
              </Label>
              <Select name="guests" value={guests} onValueChange={setGuests} disabled={isLoadingAuth || !user}>
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

            {/* Validation Messages */}
            {checkInDate && checkOutDate && !isRangeValid() && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {nights < (availability.min_stay || 1)
                    ? `Minimum stay is ${availability.min_stay} nights`
                    : availability.max_stay && nights > availability.max_stay
                    ? `Maximum stay is ${availability.max_stay} nights`
                    : "Some dates in your selection are not available"}
                </AlertDescription>
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
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="propertyId" value={propertyId} />
              <input type="hidden" name="checkIn" value={checkInDate ? format(checkInDate, "yyyy-MM-dd") : ""} />
              <input type="hidden" name="checkOut" value={checkOutDate ? format(checkOutDate, "yyyy-MM-dd") : ""} />
              <input type="hidden" name="guests" value={guests} />
              <input type="hidden" name="totalPrice" value={total.toFixed(2)} />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoadingAuth || !user || !isFormValid}
              >
                {isLoadingAuth ? "Loading..." : !user ? "Log in to Reserve" : "Reserve"}
              </Button>

              {!isLoadingAuth && user && isFormValid && <p className="text-center text-sm text-muted-foreground">You won't be charged yet</p>}
            </form>

            {/* Price Breakdown */}
            {nights > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>{nights} night{nights !== 1 ? "s" : ""}</span>
                  <span>${subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cleaning fee</span>
                  <span>${cleaningFee?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Service fee</span>
                  <span>${serviceFee?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>${total?.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Calendar Legend:</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary rounded"></div>
                  <span className="text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-muted rounded"></div>
                  <span className="text-muted-foreground">Unavailable</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
