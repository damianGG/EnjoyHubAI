"use server"

/**
 * SMS notification utility for booking confirmations and reminders.
 * This is a placeholder implementation that logs SMS to console.
 * 
 * In production, integrate with an SMS service provider such as:
 * - Twilio (recommended)
 * - SMSApi.pl (for Poland)
 * - AWS SNS
 * - Vonage (formerly Nexmo)
 */

/**
 * Sends an SMS notification.
 * Currently logs to console - integrate with SMS provider in production.
 */
export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("📱 SMS notification:", {
      to: phone,
      message: message,
    })

    // TODO: Integrate with SMS service provider
    // Example with Twilio:
    // const accountSid = process.env.TWILIO_ACCOUNT_SID
    // const authToken = process.env.TWILIO_AUTH_TOKEN
    // const client = require('twilio')(accountSid, authToken)
    // 
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone
    // })

    return { success: true }
  } catch (error) {
    console.error("Error sending SMS:", error)
    return { success: false, error: String(error) }
  }
}

/**
 * Sends a booking confirmation SMS to the customer.
 */
export async function sendBookingConfirmationSMS(
  customerPhone: string,
  customerName: string,
  bookingDetails: {
    bookingId: string
    offerTitle: string
    propertyName: string
    date: string
    startTime: string
  }
): Promise<{ success: boolean; error?: string }> {
  const message = `Witaj ${customerName}! Twoja rezerwacja została potwierdzona. ${bookingDetails.offerTitle} w ${bookingDetails.propertyName}. Data: ${bookingDetails.date}, godz. ${bookingDetails.startTime}. Nr rezerwacji: ${bookingDetails.bookingId}. Do zobaczenia! - EnjoyHub`
  
  return sendSMS(customerPhone, message)
}

/**
 * Sends a booking reminder SMS to the customer.
 */
export async function sendBookingReminderSMS(
  customerPhone: string,
  customerName: string,
  bookingDetails: {
    offerTitle: string
    propertyName: string
    date: string
    startTime: string
  }
): Promise<{ success: boolean; error?: string }> {
  const message = `Przypomnienie: Witaj ${customerName}! Jutro masz rezerwację: ${bookingDetails.offerTitle} w ${bookingDetails.propertyName}, godz. ${bookingDetails.startTime}. Prosimy o przybycie 10 min wcześniej. Do zobaczenia! - EnjoyHub`
  
  return sendSMS(customerPhone, message)
}

/**
 * Sends a request for phone number SMS.
 */
export async function sendPhoneNumberRequestSMS(
  customerEmail: string,
  customerName: string,
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  // This would typically be sent via email asking user to update their profile
  // Since we can't send SMS without a phone number
  console.log("📧 Phone number request notification:", {
    to: customerEmail,
    customerName,
    bookingId,
    message: "Requesting phone number for SMS notifications"
  })
  
  return { success: true }
}
