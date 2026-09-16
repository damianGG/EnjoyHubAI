import { queueTransactionalEmail, type EmailQueueResult } from "./outbox"
import { getEmailSiteUrl } from "./site-url"

export interface DemandAvailabilityEmailInput {
  notificationId: string
  demandRequestId: string
  recipientEmail: string
  attractionId: string
  attractionTitle: string
  desiredDate: string
  partySize: number
}

export async function sendDemandAvailabilityEmail(
  input: DemandAvailabilityEmailInput,
): Promise<EmailQueueResult> {
  const siteUrl = getEmailSiteUrl()
  const bookingUrl = `${siteUrl}/attractions/${encodeURIComponent(input.attractionId)}#booking`
  const dateLabel = formatDate(input.desiredDate)
  const title = escapeHtml(input.attractionTitle)
  const peopleLabel = input.partySize === 1 ? "1 osoby" : `${input.partySize} osób`

  const html = `<!doctype html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EnjoyHub</title></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:Arial,'Helvetica Neue',sans-serif;color:#12263a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fa;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e7ebef;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:20px 26px;border-bottom:1px solid #eef1f3;font-size:21px;font-weight:800;">enjoy<span style="color:#ff5a1f;">hub</span></td></tr>
        <tr><td style="padding:30px 28px;">
          <div style="padding:20px;border-radius:16px;background:#fff3ea;">
            <div style="font-size:24px;line-height:31px;font-weight:800;">Są miejsca w terminie, którego szukałeś</div>
            <div style="margin-top:8px;color:#66788a;font-size:14px;line-height:21px;">Rezerwacja online przez EnjoyHub jest już dostępna.</div>
          </div>
          <div style="margin-top:24px;font-size:18px;font-weight:800;">${title}</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border:1px solid #e8edf1;border-radius:12px;">
            <tr><td style="padding:12px 16px;color:#66788a;font-size:13px;">Termin</td><td align="right" style="padding:12px 16px;font-size:13px;font-weight:700;">${escapeHtml(dateLabel)}</td></tr>
            <tr><td style="padding:12px 16px;border-top:1px solid #eef1f3;color:#66788a;font-size:13px;">Twoja grupa</td><td align="right" style="padding:12px 16px;border-top:1px solid #eef1f3;font-size:13px;font-weight:700;">${escapeHtml(peopleLabel)}</td></tr>
          </table>
          <p style="margin:22px 0;color:#66788a;font-size:14px;line-height:22px;">Sprawdziliśmy aktualną dostępność i w tej chwili jest wystarczająca liczba miejsc dla Twojej grupy. Dostępność może się zmienić do czasu finalizacji płatności.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 22px;"><tr><td bgcolor="#ff5a1f" style="border-radius:10px;"><a href="${escapeAttribute(bookingUrl)}" style="display:inline-block;padding:13px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:800;">Zobacz termin i zarezerwuj →</a></td></tr></table>
          <div style="padding:14px 16px;border-radius:12px;background:#f7f9fb;color:#66788a;font-size:12px;line-height:19px;">To jednorazowe powiadomienie dotyczące zgłoszenia, które wysłałeś w EnjoyHub. Nie zapisaliśmy Cię do newslettera.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    "Są miejsca w terminie, którego szukałeś",
    "",
    input.attractionTitle,
    `Termin: ${dateLabel}`,
    `Twoja grupa: ${peopleLabel}`,
    "",
    "Rezerwacja online przez EnjoyHub jest już dostępna i obecnie jest wystarczająca liczba miejsc dla Twojej grupy.",
    "Dostępność może się zmienić do czasu finalizacji płatności.",
    "",
    `Zobacz termin i zarezerwuj: ${bookingUrl}`,
    "",
    "To jednorazowe powiadomienie dotyczące Twojego zgłoszenia w EnjoyHub. Nie zapisaliśmy Cię do newslettera.",
  ].join("\n")

  return queueTransactionalEmail({
    emailType: "demand_availability",
    sourceType: "demand_notification",
    sourceId: input.notificationId,
    dedupeKey: `demand-notification:${input.notificationId}`,
    metadata: {
      demandRequestId: input.demandRequestId,
      attractionId: input.attractionId,
      desiredDate: input.desiredDate,
      partySize: input.partySize,
    },
    to: input.recipientEmail,
    subject: `Są miejsca: ${input.attractionTitle} — ${dateLabel}`,
    html,
    text,
    tags: [
      { name: "type", value: "demand-available" },
      { name: "attraction", value: input.attractionId.slice(0, 36) },
    ],
  }, { attemptImmediately: false })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "Europe/Warsaw" })
    .format(new Date(`${value}T12:00:00+02:00`))
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] || char))
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}
