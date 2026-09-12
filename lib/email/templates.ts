const BRAND_ORANGE = "#F47521"
const BRAND_NAVY = "#12263A"
const BRAND_MUTED = "#66788A"
const BRAND_BG = "#F6F8FA"
const BRAND_PEACH = "#FFF3EA"

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export interface TeamInvitationTemplateInput {
  organizationName: string
  roleLabel: string
  inviteUrl: string
  expiresAt: string
}

export interface OrderConfirmationTicket {
  code: string
  sequenceNumber: number
  ticketTypeName: string
  url: string
}

export interface OrderConfirmationItem {
  productName: string
  ticketTypeName: string
  quantity: number
  startsAt: string
  endsAt: string
}

export interface OrderConfirmationTemplateInput {
  orderNumber: string
  customerName: string
  venueName: string
  venueCity?: string | null
  timezone: string
  totalAmount: number
  currency: string
  items: OrderConfirmationItem[]
  tickets: OrderConfirmationTicket[]
  bookingsUrl: string
}

export function renderTeamInvitationEmail(input: TeamInvitationTemplateInput): RenderedEmail {
  const organizationName = escapeHtml(input.organizationName)
  const roleLabel = escapeHtml(input.roleLabel)
  const inviteUrl = escapeAttribute(input.inviteUrl)
  const expiry = formatDateTime(input.expiresAt, "Europe/Warsaw")

  const body = `
    ${hero("👥", "Zaproszenie do zespołu", `Dołącz do organizacji <strong>${organizationName}</strong>`)}
    ${paragraph("Otrzymujesz zaproszenie do zespołu EnjoyHub. Po zaakceptowaniu będziesz mieć dostęp tylko do tej organizacji i funkcji wynikających z przypisanej roli.")}
    ${infoTable([
      ["Organizacja", organizationName],
      ["Rola", roleLabel],
      ["Ważność zaproszenia", escapeHtml(expiry)],
    ])}
    ${button("Akceptuj zaproszenie", inviteUrl)}
    ${notice("Jeśli nie spodziewasz się tego zaproszenia, możesz zignorować tę wiadomość. Link jest przypisany do adresu e-mail, na który został wysłany.")}
  `

  return {
    subject: `Zaproszenie do zespołu ${input.organizationName} w EnjoyHub`,
    html: emailLayout({ preheader: `Zaproszenie do ${input.organizationName}`, body }),
    text: [
      "Zaproszenie do zespołu EnjoyHub",
      "",
      `Organizacja: ${input.organizationName}`,
      `Rola: ${input.roleLabel}`,
      `Zaproszenie ważne do: ${expiry}`,
      "",
      `Akceptuj zaproszenie: ${input.inviteUrl}`,
      "",
      "Jeśli nie spodziewasz się tego zaproszenia, zignoruj tę wiadomość.",
    ].join("\n"),
  }
}

export function renderOrderConfirmationEmail(input: OrderConfirmationTemplateInput): RenderedEmail {
  const primaryItem = input.items[0]
  const venue = escapeHtml(input.venueName)
  const city = input.venueCity ? ` · ${escapeHtml(input.venueCity)}` : ""
  const dateLabel = primaryItem ? formatDate(primaryItem.startsAt, input.timezone) : "—"
  const timeLabel = primaryItem ? `${formatTime(primaryItem.startsAt, input.timezone)}–${formatTime(primaryItem.endsAt, input.timezone)}` : "—"
  const quantity = input.items.reduce((sum, item) => sum + item.quantity, 0)

  const itemRows = input.items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #EDF0F2;color:${BRAND_NAVY};font-size:14px;line-height:20px;">
        <strong>${escapeHtml(item.productName)}</strong><br>
        <span style="color:${BRAND_MUTED};">${escapeHtml(item.ticketTypeName)} × ${item.quantity}</span>
      </td>
    </tr>
  `).join("")

  const ticketRows = input.tickets.map((ticket, index) => `
    <tr>
      <td style="padding:${index === 0 ? "0" : "10px 0 0"};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #F0E2D8;border-radius:12px;background:#FFFAF6;">
          <tr>
            <td style="padding:14px 16px;color:${BRAND_NAVY};font-size:14px;line-height:20px;">
              <strong>Bilet #${ticket.sequenceNumber}</strong><br>
              <span style="color:${BRAND_MUTED};">${escapeHtml(ticket.ticketTypeName)}</span><br>
              <span style="font-family:monospace;font-size:12px;color:#7A8793;">${escapeHtml(ticket.code)}</span>
            </td>
            <td align="right" style="padding:14px 16px;white-space:nowrap;">
              <a href="${escapeAttribute(ticket.url)}" style="display:inline-block;color:${BRAND_ORANGE};font-size:13px;font-weight:700;text-decoration:none;">Pokaż bilet →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("")

  const body = `
    ${hero("✓", "Rezerwacja potwierdzona!", "Twoje bilety są gotowe do użycia.")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #E8EDF1;border-radius:14px;background:#FFFFFF;">
      <tr><td style="padding:20px;">
        <div style="font-size:19px;font-weight:800;color:${BRAND_NAVY};">${venue}${city}</div>
        <div style="margin-top:5px;font-size:13px;color:${BRAND_MUTED};">Zamówienie #${escapeHtml(input.orderNumber)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
          <tr>
            ${metricCell("Data", escapeHtml(dateLabel))}
            ${metricCell("Godzina", escapeHtml(timeLabel))}
            ${metricCell("Bilety", String(quantity))}
            ${metricCell("Razem", escapeHtml(formatMoney(input.totalAmount, input.currency)))}
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="margin:0 0 8px;color:${BRAND_NAVY};font-size:16px;font-weight:800;">Szczegóły zakupu</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">${itemRows}</table>
    ${input.tickets.length ? `<div style="margin:0 0 10px;color:${BRAND_NAVY};font-size:16px;font-weight:800;">Twoje bilety</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">${ticketRows}</table>` : ""}
    ${button("Otwórz moje bilety", escapeAttribute(input.bookingsUrl))}
    ${notice("Przy wejściu pokaż kod QR biletu na ekranie telefonu. Każdy bilet można wykorzystać tylko raz.")}
  `

  const ticketText = input.tickets.map((ticket) => `Bilet #${ticket.sequenceNumber} (${ticket.ticketTypeName}): ${ticket.url}`).join("\n")
  const itemsText = input.items.map((item) => `${item.productName} — ${item.ticketTypeName} × ${item.quantity}`).join("\n")

  return {
    subject: `Rezerwacja potwierdzona — zamówienie #${input.orderNumber}`,
    html: emailLayout({ preheader: `Twoje bilety do ${input.venueName} są gotowe`, body }),
    text: [
      "Rezerwacja potwierdzona!",
      "",
      `${input.venueName}${input.venueCity ? `, ${input.venueCity}` : ""}`,
      `Zamówienie #${input.orderNumber}`,
      `Data: ${dateLabel}`,
      `Godzina: ${timeLabel}`,
      `Razem: ${formatMoney(input.totalAmount, input.currency)}`,
      "",
      itemsText,
      "",
      ticketText,
      "",
      `Wszystkie bilety: ${input.bookingsUrl}`,
      "",
      "Przy wejściu pokaż kod QR biletu. Każdy bilet można wykorzystać tylko raz.",
    ].filter(Boolean).join("\n"),
  }
}

function emailLayout({ preheader, body }: { preheader: string; body: string }) {
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>EnjoyHub</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:Arial,'Helvetica Neue',sans-serif;color:${BRAND_NAVY};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_BG};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E7EBEF;border-radius:20px;overflow:hidden;box-shadow:0 10px 28px rgba(18,38,58,.06);">
        <tr><td style="padding:20px 26px;border-bottom:1px solid #EEF1F3;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font-size:21px;font-weight:800;color:${BRAND_NAVY};"><span style="display:inline-block;margin-right:8px;color:#FFFFFF;background:${BRAND_ORANGE};border-radius:10px;padding:4px 7px;font-size:17px;vertical-align:1px;">☺</span>EnjoyHub</td>
            <td align="right" style="font-size:11px;color:#8A98A5;">Więcej atrakcji. Więcej radości.</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:30px 28px 26px;">${body}</td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #EEF1F3;background:#FCFDFE;color:#7A8996;font-size:11px;line-height:17px;">
          <strong style="color:${BRAND_NAVY};">EnjoyHub</strong><br>
          Ta wiadomość dotyczy Twojego konta, rezerwacji lub organizacji w EnjoyHub.<br>
          <span style="color:#A0AAB3;">© ${new Date().getFullYear()} EnjoyHub</span>
        </td></tr>
        <tr><td style="height:5px;background:${BRAND_ORANGE};font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function hero(icon: string, title: string, subtitle: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;background:${BRAND_PEACH};border-radius:16px;">
      <tr>
        <td style="padding:22px 20px;">
          <div style="color:${BRAND_NAVY};font-size:26px;line-height:32px;font-weight:800;">${title}</div>
          <div style="margin-top:7px;color:${BRAND_MUTED};font-size:14px;line-height:21px;">${subtitle}</div>
        </td>
        <td width="74" align="center" style="padding:18px 20px 18px 0;">
          <div style="width:56px;height:56px;border-radius:16px;background:#FFFFFF;color:${BRAND_ORANGE};font-size:29px;line-height:56px;text-align:center;">${icon}</div>
        </td>
      </tr>
    </table>`
}

function paragraph(value: string) {
  return `<p style="margin:0 0 20px;color:${BRAND_MUTED};font-size:14px;line-height:22px;">${value}</p>`
}

function infoTable(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border:1px solid #E8EDF1;border-radius:14px;">${rows.map(([label, value], index) => `
    <tr>
      <td style="padding:12px 16px;${index ? "border-top:1px solid #EEF1F3;" : ""}color:${BRAND_MUTED};font-size:13px;">${escapeHtml(label)}</td>
      <td align="right" style="padding:12px 16px;${index ? "border-top:1px solid #EEF1F3;" : ""}color:${BRAND_NAVY};font-size:13px;font-weight:700;">${value}</td>
    </tr>`).join("")}</table>`
}

function button(label: string, href: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 22px;"><tr><td align="center" bgcolor="${BRAND_ORANGE}" style="border-radius:10px;"><a href="${href}" style="display:inline-block;padding:13px 24px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:800;">${escapeHtml(label)} →</a></td></tr></table>`
}

function notice(value: string) {
  return `<div style="padding:14px 16px;border-radius:12px;background:#F7F9FB;color:${BRAND_MUTED};font-size:12px;line-height:19px;">ⓘ&nbsp; ${value}</div>`
}

function metricCell(label: string, value: string) {
  return `<td width="25%" valign="top" style="padding:8px 8px 8px 0;border-right:1px solid #EEF1F3;"><div style="color:#8A98A5;font-size:10px;text-transform:uppercase;letter-spacing:.3px;">${label}</div><div style="margin-top:5px;color:${BRAND_NAVY};font-size:13px;font-weight:800;">${value}</div></td>`
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(amount)
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: timezone }).format(new Date(value))
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value))
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value))
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
