import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sendBookingConfirmationEmail, sendBookingReminderEmail } from "@/lib/notifications/email"
import { sendBookingConfirmationSMS, sendBookingReminderSMS } from "@/lib/notifications/sms"

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

export async function POST(
  request: Request,
  { params }: { params: { bookingId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const bookingId = params.bookingId

    // Get the booking details
    const { data: booking, error: bookingError } = await supabase
      .from("offer_bookings")
      .select(`
        *,
        offers (
          id,
          title,
          place_id
        ),
        properties!offer_bookings_place_id_fkey (
          id,
          title,
          host_id
        )
      `)
      .eq("id", bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Check if the current user is the host/owner of the property
    if (booking.properties?.host_id !== user.id) {
      return NextResponse.json(
        { error: "You are not authorized to approve this booking" },
        { status: 403 }
      )
    }

    // Check if booking is already confirmed or cancelled
    if (booking.status === "confirmed") {
      return NextResponse.json(
        { error: "Booking is already confirmed" },
        { status: 400 }
      )
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot approve a cancelled booking" },
        { status: 400 }
      )
    }

    // Update booking status to confirmed
    const { error: updateError } = await supabase
      .from("offer_bookings")
      .update({ status: "confirmed" })
      .eq("id", bookingId)

    if (updateError) {
      console.error("Error updating booking status:", updateError)
      return NextResponse.json(
        { error: "Failed to approve booking" },
        { status: 500 }
      )
    }

    // Format date for display
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split("-")
      return `${day}.${month}.${year}`
    }

    // Send email notification
    const emailResult = await sendBookingConfirmationEmail(
      booking.customer_email,
      booking.customer_name,
      {
        bookingId: booking.id,
        offerTitle: booking.offers?.title || "Unknown Offer",
        propertyName: booking.properties?.title || "Unknown Property",
        date: formatDate(booking.booking_date),
        startTime: booking.start_time,
        endTime: booking.end_time,
        persons: booking.persons,
      }
    )

    // Send SMS notification if phone number is provided
    let smsResult = { success: false }
    if (booking.customer_phone) {
      smsResult = await sendBookingConfirmationSMS(
        booking.customer_phone,
        booking.customer_name,
        {
          bookingId: booking.id,
          offerTitle: booking.offers?.title || "Unknown Offer",
          propertyName: booking.properties?.title || "Unknown Property",
          date: formatDate(booking.booking_date),
          startTime: booking.start_time,
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Booking approved successfully",
      notifications: {
        email: emailResult.success,
        sms: smsResult.success,
        phoneProvided: !!booking.customer_phone,
      },
    })
  } catch (error) {
    console.error("Error approving booking:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
