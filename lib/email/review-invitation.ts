import { queueTransactionalEmail, type EmailQueueResult } from "@/lib/email/outbox"
import { getEmailSiteUrl } from "@/lib/email/site-url"

type ReviewInvitationEmailInput = {
  invitationId: string
  token: string
  recipientEmail: string
  recipientName?: string | null
  propertyId: string
  propertyTitle: string
}

export async function sendReviewInvitationEmail(input: ReviewInvitationEmailInput): Promise<EmailQueueResult> {
  const siteUrl = getEmailSiteUrl()
  const reviewUrl = `${siteUrl}/opinia/${encodeURIComponent(input.token)}`
  const firstName = input.recipientName?.trim().split(/\s+/)[0]
  const greeting = firstName ? `${escapeHtml(firstName)},` : "Cześć,"
  const subject = `Jak było w ${input.propertyTitle}?`

  const html = `
    <!doctype html>
    <html lang="pl">
      <body style="margin:0;background:#f7f7f8;font-family:Arial,sans-serif;color:#0b1220;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #ececef;">
              <tr><td style="padding:28px 28px 8px;">
                <div style="font-size:13px;font-weight:700;color:#ff5a1f;letter-spacing:.04em;">ENJOYHUB · ZWERYFIKOWANA WIZYTA</div>
                <h1 style="margin:14px 0 8px;font-size:26px;line-height:1.2;">${greeting} jak było?</h1>
                <p style="margin:0;color:#596273;font-size:15px;line-height:1.65;">Twój bilet do <strong>${escapeHtml(input.propertyTitle)}</strong> został wykorzystany. Napisz krótką opinię i pomóż innym wybrać dobrą atrakcję.</p>
              </td></tr>
              <tr><td style="padding:22px 28px;">
                <a href="${reviewUrl}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px;">Dodaj opinię</a>
              </td></tr>
              <tr><td style="padding:0 28px 28px;color:#697386;font-size:12px;line-height:1.6;">
                Ta opinia otrzyma oznaczenie „Zweryfikowana wizyta”, ponieważ zaproszenie jest powiązane z faktycznie wykorzystanym biletem EnjoyHub. Link jest indywidualny — nie przekazuj go innym osobom.
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `

  const text = `${greeting}\n\nTwój bilet do ${input.propertyTitle} został wykorzystany. Napisz krótką opinię i pomóż innym wybrać dobrą atrakcję.\n\nDodaj opinię: ${reviewUrl}\n\nOpinia będzie oznaczona jako „Zweryfikowana wizyta”. Link jest indywidualny.`

  return queueTransactionalEmail({
    emailType: "review_invitation",
    sourceType: "review_invitation",
    sourceId: input.invitationId,
    dedupeKey: `review-invitation:${input.invitationId}`,
    metadata: { propertyId: input.propertyId },
    to: input.recipientEmail,
    subject,
    html,
    text,
    tags: [{ name: "type", value: "verified-review-invitation" }],
  }, { attemptImmediately: false })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
