"use server"

/**
 * Email notification utility for booking confirmations and reminders.
 * This is a placeholder implementation that logs emails to console.
 * 
 * In production, integrate with an email service provider such as:
 * - Resend (recommended for Next.js)
 * - SendGrid
 * - AWS SES
 * - Nodemailer with SMTP
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Sends an email notification.
 * Currently logs to console - integrate with email provider in production.
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("📧 Email notification:", {
      to: options.to,
      subject: options.subject,
      preview: options.text || options.html.substring(0, 100),
    })

    // TODO: Integrate with email service provider
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'EnjoyHub <notifications@enjoyhub.com>',
    //   to: options.to,
    //   subject: options.subject,
    //   html: options.html,
    // })

    return { success: true }
  } catch (error) {
    console.error("Error sending email:", error)
    return { success: false, error: String(error) }
  }
}

/**
 * Sends a booking confirmation email to the customer.
 */
export async function sendBookingConfirmationEmail(
  customerEmail: string,
  customerName: string,
  bookingDetails: {
    bookingId: string
    offerTitle: string
    propertyName: string
    date: string
    startTime: string
    endTime: string
    persons: number
  }
): Promise<{ success: boolean; error?: string }> {
  const subject = `Potwierdzenie rezerwacji - ${bookingDetails.offerTitle}`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF4F9E 0%, #D848FF 50%, #7A3CFF 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .detail-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
          .detail-label { font-weight: bold; color: #666; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Rezerwacja Potwierdzona!</h1>
          </div>
          <div class="content">
            <p>Witaj ${customerName},</p>
            <p>Twoja rezerwacja została potwierdzona przez właściciela obiektu.</p>
            
            <h3>Szczegóły rezerwacji:</h3>
            <div class="detail-row">
              <span class="detail-label">Numer rezerwacji:</span> ${bookingDetails.bookingId}
            </div>
            <div class="detail-row">
              <span class="detail-label">Oferta:</span> ${bookingDetails.offerTitle}
            </div>
            <div class="detail-row">
              <span class="detail-label">Miejsce:</span> ${bookingDetails.propertyName}
            </div>
            <div class="detail-row">
              <span class="detail-label">Data:</span> ${bookingDetails.date}
            </div>
            <div class="detail-row">
              <span class="detail-label">Godzina:</span> ${bookingDetails.startTime} - ${bookingDetails.endTime}
            </div>
            <div class="detail-row">
              <span class="detail-label">Liczba osób:</span> ${bookingDetails.persons}
            </div>
            
            <p style="margin-top: 30px;">
              <strong>Przypomnienie:</strong> Prosimy o przybycie na miejsce 10 minut przed rozpoczęciem rezerwacji.
            </p>
            
            <p>Dziękujemy za skorzystanie z naszych usług!</p>
          </div>
          <div class="footer">
            <p>EnjoyHub - Odkrywaj niesamowite miejsca</p>
          </div>
        </div>
      </body>
    </html>
  `
  
  const text = `
Witaj ${customerName},

Twoja rezerwacja została potwierdzona!

Szczegóły rezerwacji:
- Numer rezerwacji: ${bookingDetails.bookingId}
- Oferta: ${bookingDetails.offerTitle}
- Miejsce: ${bookingDetails.propertyName}
- Data: ${bookingDetails.date}
- Godzina: ${bookingDetails.startTime} - ${bookingDetails.endTime}
- Liczba osób: ${bookingDetails.persons}

Przypomnienie: Prosimy o przybycie na miejsce 10 minut przed rozpoczęciem rezerwacji.

Dziękujemy za skorzystanie z naszych usług!

EnjoyHub - Odkrywaj niesamowite miejsca
  `

  return sendEmail({ to: customerEmail, subject, html, text })
}

/**
 * Sends a booking reminder email to the customer.
 */
export async function sendBookingReminderEmail(
  customerEmail: string,
  customerName: string,
  bookingDetails: {
    offerTitle: string
    propertyName: string
    date: string
    startTime: string
  }
): Promise<{ success: boolean; error?: string }> {
  const subject = `Przypomnienie o rezerwacji - ${bookingDetails.offerTitle}`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF4F9E 0%, #D848FF 50%, #7A3CFF 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .reminder { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Przypomnienie o rezerwacji</h1>
          </div>
          <div class="content">
            <p>Witaj ${customerName},</p>
            
            <div class="reminder">
              <strong>Przypominamy o Twojej nadchodzącej rezerwacji:</strong>
              <p style="margin: 10px 0 0 0;">
                <strong>${bookingDetails.offerTitle}</strong><br>
                ${bookingDetails.propertyName}<br>
                Data: ${bookingDetails.date}<br>
                Godzina: ${bookingDetails.startTime}
              </p>
            </div>
            
            <p>Prosimy o przybycie na miejsce 10 minut przed rozpoczęciem rezerwacji.</p>
            <p>Do zobaczenia!</p>
          </div>
          <div class="footer">
            <p>EnjoyHub - Odkrywaj niesamowite miejsca</p>
          </div>
        </div>
      </body>
    </html>
  `
  
  const text = `
Witaj ${customerName},

Przypominamy o Twojej nadchodzącej rezerwacji:

${bookingDetails.offerTitle}
${bookingDetails.propertyName}
Data: ${bookingDetails.date}
Godzina: ${bookingDetails.startTime}

Prosimy o przybycie na miejsce 10 minut przed rozpoczęciem rezerwacji.

Do zobaczenia!

EnjoyHub - Odkrywaj niesamowite miejsca
  `

  return sendEmail({ to: customerEmail, subject, html, text })
}
