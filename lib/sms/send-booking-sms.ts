"use server"

import { createClient } from "@/lib/supabase/server"
import { formatDisplayDate } from "@/lib/utils"

interface SendBookingSMSParams {
  bookingId: string
}

interface SMSResult {
  success: boolean
  message: string
}

/**
 * Sends a booking confirmation SMS to the customer's phone
 * This is a placeholder implementation. In production, you would integrate with:
 * - Twilio (https://www.twilio.com/)
 * - AWS SNS
 * - Other SMS gateway services
 */
export async function sendBookingSMS(params: SendBookingSMSParams): Promise<SMSResult> {
  const { bookingId } = params

  try {
    const supabase = await createClient()

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from("offer_bookings")
      .select(`
        *,
        offers (
          title,
          properties (
            title,
            address,
            city
          )
        )
      `)
      .eq("id", bookingId)
      .single()

    if (bookingError || !booking) {
      return {
        success: false,
        message: "Nie znaleziono rezerwacji"
      }
    }

    if (!booking.customer_phone) {
      return {
        success: false,
        message: "Brak numeru telefonu w rezerwacji"
      }
    }

    const offer = booking.offers
    const property = offer?.properties

    // Format the SMS message
    const formattedDate = formatDisplayDate(booking.booking_date)
    const startTime = booking.start_time.substring(0, 5) // HH:MM
    const endTime = booking.end_time.substring(0, 5) // HH:MM
    
    const smsMessage = `
EnjoyHub - Potwierdzenie rezerwacji

${offer?.title || 'Rezerwacja'}
Data: ${formattedDate}
Godzina: ${startTime} - ${endTime}
Liczba osób: ${booking.persons}

Miejsce: ${property?.title || 'N/A'}
${property?.address ? `Adres: ${property.address}, ${property.city}` : ''}

Płatność na miejscu. Prosimy o przybycie 10 min przed godziną.

ID: ${bookingId.substring(0, 8)}
    `.trim()

    // TODO: Integrate with actual SMS service
    // For now, we'll just log the message and return success
    console.log('SMS would be sent to:', booking.customer_phone)
    console.log('SMS message:', smsMessage)

    // Example Twilio integration (commented out):
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER
    
    const client = require('twilio')(accountSid, authToken)
    
    await client.messages.create({
      body: smsMessage,
      from: twilioPhone,
      to: booking.customer_phone
    })
    */

    // For demo purposes, we'll simulate success
    return {
      success: true,
      message: `SMS wysłany na numer ${booking.customer_phone}`
    }

  } catch (error) {
    console.error('Error sending SMS:', error)
    return {
      success: false,
      message: "Wystąpił błąd podczas wysyłania SMS"
    }
  }
}
