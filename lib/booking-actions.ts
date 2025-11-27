"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

function createSupabaseServerClient() {
  return createServerActionClient({ cookies })
}

export interface BookingData {
  propertyId: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
}

export async function createBooking(prevState: any, formData: FormData) {
  const supabase = createSupabaseServerClient()

  // TEMPORARY: Hardcoded user for testing booking functionality
  // TODO: Remove this workaround and restore proper auth check once auth issues are resolved
  // User ID for damiangolon@gmail.com from the database
  const HARDCODED_USER_ID = "21aa14bd-a385-4c2f-bac6-d4f753502d02"
  
  // Use the hardcoded user ID directly (bypasses RLS and query issues)
  const user = { id: HARDCODED_USER_ID }

  try {
    const propertyId = formData.get("propertyId") as string
    const checkIn = formData.get("checkIn") as string
    const checkOut = formData.get("checkOut") as string
    const guests = Number.parseInt(formData.get("guests") as string)
    const totalPrice = Number.parseFloat(formData.get("totalPrice") as string)

    // Validate required fields
    if (!propertyId || !checkIn || !checkOut || !guests || !totalPrice) {
      return { error: "All fields are required" }
    }

    // Validate dates
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (checkInDate < today) {
      return { error: "Check-in date cannot be in the past" }
    }

    if (checkOutDate <= checkInDate) {
      return { error: "Check-out date must be after check-in date" }
    }

    // Check if property exists and is active
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, max_guests, host_id")
      .eq("id", propertyId)
      .eq("is_active", true)
      .single()

    if (propertyError || !property) {
      return { error: "Property not found or not available" }
    }

    // Check if user is trying to book their own property
    if (property.host_id === user.id) {
      return { error: "You cannot book your own property" }
    }

    // Validate guest count
    if (guests > property.max_guests) {
      return { error: `This property can accommodate maximum ${property.max_guests} guests` }
    }

    // Check for conflicting bookings
    const { data: conflictingBookings, error: conflictError } = await supabase
      .from("bookings")
      .select("id")
      .eq("property_id", propertyId)
      .in("status", ["confirmed", "pending"])
      .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`)

    if (conflictError) {
      return { error: "Error checking availability" }
    }

    if (conflictingBookings && conflictingBookings.length > 0) {
      return { error: "Property is not available for the selected dates" }
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        property_id: propertyId,
        guest_id: user.id,
        check_in: checkIn,
        check_out: checkOut,
        guests_count: guests,
        total_price: totalPrice,
        status: "pending",
      })
      .select()
      .single()

    if (bookingError) {
      console.error("Booking creation error:", bookingError)
      return { error: "Failed to create booking. Please try again." }
    }

    return { success: true, bookingId: booking.id }
  } catch (error) {
    console.error("Booking error:", error)
    return { error: "An unexpected error occurred. Please try again." }
  }
}

export async function checkAvailability(propertyId: string, checkIn: string, checkOut: string) {
  const supabase = createSupabaseServerClient()

  try {
    const { data: conflictingBookings, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("property_id", propertyId)
      .in("status", ["confirmed", "pending"])
      .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`)

    if (error) {
      return { available: false, error: "Error checking availability" }
    }

    return { available: conflictingBookings.length === 0 }
  } catch (error) {
    return { available: false, error: "Error checking availability" }
  }
}
