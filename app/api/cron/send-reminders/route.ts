import { NextResponse } from "next/server"
import { sendBookingReminders } from "@/lib/notifications/reminder-scheduler"

/**
 * API endpoint for sending booking reminders.
 * 
 * This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)
 * to send reminders 24 hours before bookings.
 * 
 * For security, you should add an authorization header check:
 * - Use a secret token in the Authorization header
 * - Or use Vercel Cron's built-in authentication
 * 
 * Example cron configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-reminders",
 *     "schedule": "0 10 * * *"
 *   }]
 * }
 * 
 * This runs daily at 10:00 AM to send reminders for next day's bookings.
 */
export async function GET(request: Request) {
  try {
    // Verify the request is from a trusted source
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.CRON_SECRET
    
    // Require authentication - fail if CRON_SECRET is not set
    if (!expectedToken) {
      console.error("CRON_SECRET is not configured")
      return NextResponse.json(
        { error: "Service not configured" },
        { status: 503 }
      )
    }
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Send reminders
    const result = await sendBookingReminders()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send reminders" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Reminders sent successfully",
      stats: {
        remindersSent: result.remindersSent,
        emailsSent: result.emailsSent,
        smsSent: result.smsSent,
        errors: result.errors,
      },
    })
  } catch (error) {
    console.error("Error in send-reminders endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
