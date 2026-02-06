import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/notifications/email"

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
          title
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
        { error: "You are not authorized to reject this booking" },
        { status: 403 }
      )
    }

    // Check if booking is already cancelled
    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Booking is already cancelled" },
        { status: 400 }
      )
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from("offer_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)

    if (updateError) {
      console.error("Error updating booking status:", updateError)
      return NextResponse.json(
        { error: "Failed to reject booking" },
        { status: 500 }
      )
    }

    // Format date for display
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split("-")
      return `${day}.${month}.${year}`
    }

    // Send rejection email notification
    const emailResult = await sendEmail({
      to: booking.customer_email,
      subject: `Rezerwacja odrzucona - ${booking.offers?.title || "Unknown Offer"}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>❌ Rezerwacja Odrzucona</h1>
              </div>
              <div class="content">
                <p>Witaj ${booking.customer_name},</p>
                <p>Niestety, Twoja rezerwacja została odrzucona przez właściciela obiektu.</p>
                
                <h3>Szczegóły rezerwacji:</h3>
                <p>
                  <strong>Oferta:</strong> ${booking.offers?.title || "Unknown Offer"}<br>
                  <strong>Data:</strong> ${formatDate(booking.booking_date)}<br>
                  <strong>Godzina:</strong> ${booking.start_time}
                </p>
                
                <p>Zachęcamy do sprawdzenia innych dostępnych terminów lub ofert.</p>
              </div>
              <div class="footer">
                <p>EnjoyHub - Odkrywaj niesamowite miejsca</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Witaj ${booking.customer_name},

Niestety, Twoja rezerwacja została odrzucona przez właściciela obiektu.

Szczegóły rezerwacji:
- Oferta: ${booking.offers?.title || "Unknown Offer"}
- Data: ${formatDate(booking.booking_date)}
- Godzina: ${booking.start_time}

Zachęcamy do sprawdzenia innych dostępnych terminów lub ofert.

EnjoyHub - Odkrywaj niesamowite miejsca
      `,
    })

    return NextResponse.json({
      success: true,
      message: "Booking rejected successfully",
      notifications: {
        email: emailResult.success,
      },
    })
  } catch (error) {
    console.error("Error rejecting booking:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
