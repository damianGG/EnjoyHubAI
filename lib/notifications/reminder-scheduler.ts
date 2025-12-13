"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { sendBookingReminderEmail } from "./email"
import { sendBookingReminderSMS } from "./sms"

/**
 * Scheduler for sending booking reminders.
 * This function should be called by a cron job or scheduled task.
 * 
 * Sends reminders to customers for bookings on the next day.
 * Note: The exact timing depends on when the cron job runs.
 * For precise 24-hour reminders, the cron should run at the same time bookings typically occur.
 */
export async function sendBookingReminders() {
  try {
    // Use service role key for cron jobs instead of cookies
    // This provides proper authentication for server-side operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // No-op for service calls
          },
        },
      }
    )

    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split("T")[0]

    // Get all confirmed bookings for tomorrow
    const { data: bookings, error } = await supabase
      .from("offer_bookings")
      .select(`
        *,
        offers (
          id,
          title
        ),
        properties!offer_bookings_place_id_fkey (
          id,
          title
        )
      `)
      .eq("booking_date", tomorrowDate)
      .eq("status", "confirmed")

    if (error) {
      console.error("Error fetching bookings for reminders:", error)
      return { success: false, error: error.message }
    }

    if (!bookings || bookings.length === 0) {
      console.log("No bookings found for tomorrow")
      return { success: true, remindersSent: 0 }
    }

    let emailsSent = 0
    let smsSent = 0
    let errors = 0

    // Format date for display
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split("-")
      return `${day}.${month}.${year}`
    }

    // Send reminders for each booking
    for (const booking of bookings) {
      try {
        // Send email reminder
        const emailResult = await sendBookingReminderEmail(
          booking.customer_email,
          booking.customer_name,
          {
            offerTitle: booking.offers?.title || "Unknown Offer",
            propertyName: booking.properties?.title || "Unknown Property",
            date: formatDate(booking.booking_date),
            startTime: booking.start_time,
          }
        )

        if (emailResult.success) {
          emailsSent++
        }

        // Send SMS reminder if phone number is provided
        if (booking.customer_phone) {
          const smsResult = await sendBookingReminderSMS(
            booking.customer_phone,
            booking.customer_name,
            {
              offerTitle: booking.offers?.title || "Unknown Offer",
              propertyName: booking.properties?.title || "Unknown Property",
              date: formatDate(booking.booking_date),
              startTime: booking.start_time,
            }
          )

          if (smsResult.success) {
            smsSent++
          }
        }
      } catch (err) {
        console.error(`Error sending reminder for booking ${booking.id}:`, err)
        errors++
      }
    }

    console.log(`Reminders sent: ${emailsSent} emails, ${smsSent} SMS, ${errors} errors`)

    return {
      success: true,
      remindersSent: emailsSent + smsSent,
      emailsSent,
      smsSent,
      errors,
    }
  } catch (error) {
    console.error("Error in sendBookingReminders:", error)
    return { success: false, error: String(error) }
  }
}
