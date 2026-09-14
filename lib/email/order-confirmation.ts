import { createAdminClient } from "@/lib/supabase/admin"

import { sendTransactionalEmail, type EmailSendResult } from "./client"
import { getEmailSiteUrl } from "./site-url"
import { renderOrderConfirmationEmail } from "./templates"

type SellerSnapshot = {
  legal_name?: string
  tax_id?: string
  email?: string
  legal_address?: string
  contact_phone?: string
  registry_name?: string | null
  registry_number?: string | null
}

type CancellationSnapshot = {
  title?: string
  shortSummary?: string
  short_summary?: string
  fullText?: string
  full_text?: string
}

type OrderRow = {
  id: string
  order_number: number | string
  venue_id: string
  customer_name: string
  customer_email: string
  status: string
  payment_status: string
  currency: string
  total_amount: number | string
  marketplace_terms_version: string | null
  cancellation_policy_version: string | null
  seller_snapshot: SellerSnapshot | null
  cancellation_policy_snapshot: CancellationSnapshot | null
}

type VenueRow = {
  id: string
  name: string
  city: string | null
  timezone: string
}

type OrderItemRow = {
  id: string
  session_id: string
  product_name: string
  ticket_type_name: string
  quantity: number
}

type SessionRow = {
  id: string
  starts_at: string
  ends_at: string
}

type TicketRow = {
  ticket_code: string
  order_item_id: string
  sequence_number: number
  status: string
}

export async function sendOrderConfirmationEmail(orderId: string): Promise<EmailSendResult> {
  const supabase = createAdminClient()
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, venue_id, customer_name, customer_email, status, payment_status, currency, total_amount, marketplace_terms_version, cancellation_policy_version, seller_snapshot, cancellation_policy_snapshot")
    .eq("id", orderId)
    .maybeSingle()

  if (orderError || !orderData) {
    return { sent: false, reason: "provider_error", error: orderError?.message || "Order not found for email" }
  }

  const order = orderData as unknown as OrderRow
  if (order.status !== "confirmed" || order.payment_status !== "paid") {
    return { sent: false, reason: "provider_error", error: "Order is not confirmed and paid" }
  }

  const [{ data: venueData, error: venueError }, { data: itemData, error: itemError }, { data: ticketData, error: ticketError }] = await Promise.all([
    supabase.from("venues").select("id, name, city, timezone").eq("id", order.venue_id).maybeSingle(),
    supabase.from("order_items").select("id, session_id, product_name, ticket_type_name, quantity").eq("order_id", order.id).order("created_at"),
    supabase.from("tickets").select("ticket_code, order_item_id, sequence_number, status").eq("order_id", order.id).order("sequence_number"),
  ])

  if (venueError || itemError || ticketError || !venueData) {
    return {
      sent: false,
      reason: "provider_error",
      error: venueError?.message || itemError?.message || ticketError?.message || "Missing booking data for email",
    }
  }

  const venue = venueData as VenueRow
  const items = (itemData ?? []) as OrderItemRow[]
  const tickets = ((ticketData ?? []) as TicketRow[]).filter((ticket) => ticket.status !== "void")
  const sessionIds = [...new Set(items.map((item) => item.session_id).filter(Boolean))]

  let sessions: SessionRow[] = []
  if (sessionIds.length > 0) {
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, starts_at, ends_at")
      .in("id", sessionIds)

    if (sessionError) {
      return { sent: false, reason: "provider_error", error: sessionError.message }
    }
    sessions = (sessionData ?? []) as SessionRow[]
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const itemById = new Map(items.map((item) => [item.id, item]))
  const siteUrl = getEmailSiteUrl()
  const seller = order.seller_snapshot
  const cancellation = order.cancellation_policy_snapshot
  const cancellationSummary = cancellation?.shortSummary || cancellation?.short_summary || cancellation?.fullText || cancellation?.full_text || null

  const rendered = renderOrderConfirmationEmail({
    orderNumber: String(order.order_number),
    customerName: order.customer_name,
    venueName: venue.name,
    venueCity: venue.city,
    timezone: venue.timezone || "Europe/Warsaw",
    totalAmount: Number(order.total_amount),
    currency: order.currency,
    items: items.flatMap((item) => {
      const session = sessionById.get(item.session_id)
      if (!session) return []
      return [{
        productName: item.product_name,
        ticketTypeName: item.ticket_type_name,
        quantity: item.quantity,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
      }]
    }),
    tickets: tickets.map((ticket) => ({
      code: ticket.ticket_code,
      sequenceNumber: ticket.sequence_number,
      ticketTypeName: itemById.get(ticket.order_item_id)?.ticket_type_name || "Bilet",
      url: `${siteUrl}/bilet/${encodeURIComponent(ticket.ticket_code)}`,
    })),
    bookingsUrl: `${siteUrl}/dashboard/bookings`,
    seller: seller?.legal_name ? {
      legalName: seller.legal_name,
      taxId: seller.tax_id ?? "",
      legalAddress: seller.legal_address ?? "",
      email: seller.email ?? "",
      phone: seller.contact_phone ?? "",
      registry: seller.registry_name && seller.registry_number
        ? `${seller.registry_name} ${seller.registry_number}`
        : null,
    } : null,
    cancellation: cancellation?.title || cancellationSummary ? {
      title: cancellation?.title ?? "Zasady anulowania",
      summary: cancellationSummary ?? "Zasady anulowania zostały zapisane przy zamówieniu.",
    } : null,
    termsVersion: order.marketplace_terms_version,
    cancellationVersion: order.cancellation_policy_version,
    termsUrl: `${siteUrl}/regulamin`,
    cancellationUrl: `${siteUrl}/zasady-anulowania`,
  })

  return sendTransactionalEmail({
    to: order.customer_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [
      { name: "type", value: "booking-confirmation" },
      { name: "order", value: String(order.order_number) },
    ],
  })
}
