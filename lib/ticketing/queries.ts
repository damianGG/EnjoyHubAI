import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type {
  CheckoutOrderSummary,
  TicketingCheckoutSession,
  TicketingSessionListItem,
} from "@/lib/ticketing/types"

interface RawAvailability {
  available_capacity_units: number
  is_sellable: boolean
}

interface RawTicketType {
  id: string
  name: string
  description: string | null
  price_amount: number | string
  currency: string
  capacity_units: number
  min_quantity_per_order: number
  max_quantity_per_order: number | null
  is_active: boolean
}

interface RawVenue {
  id: string
  name: string
  city: string | null
  address_line_1: string | null
  timezone: string
}

interface RawProduct {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  min_participants: number
  max_participants: number | null
  venues: RawVenue
  ticket_types: RawTicketType[]
}

interface RawSession {
  id: string
  starts_at: string
  ends_at: string
  capacity: number
  products: RawProduct
}

const publicSessionSelect = `
  id,
  starts_at,
  ends_at,
  capacity,
  products!inner (
    id,
    name,
    description,
    duration_minutes,
    min_participants,
    max_participants,
    venues!inner (
      id,
      name,
      city,
      address_line_1,
      timezone
    ),
    ticket_types (
      id,
      name,
      description,
      price_amount,
      currency,
      capacity_units,
      min_quantity_per_order,
      max_quantity_per_order,
      is_active
    )
  )
`

async function getAvailability(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
) {
  const { data, error } = await supabase.rpc(
    "ticketing_get_session_availability",
    { p_session_id: sessionId },
  )

  if (error || !data?.[0]) return null
  return data[0] as RawAvailability
}

export async function getCheckoutSession(sessionId: string) {
  if (!isSupabaseConfigured) return null

  const supabase = createClient()
  const [sessionResult, availability] = await Promise.all([
    supabase
      .from("sessions")
      .select(publicSessionSelect)
      .eq("id", sessionId)
      .eq("status", "scheduled")
      .single(),
    getAvailability(supabase, sessionId),
  ])

  if (
    sessionResult.error ||
    !sessionResult.data ||
    !availability ||
    !availability.is_sellable
  ) return null

  const session = sessionResult.data as unknown as RawSession
  const product = session.products
  const venue = product.venues

  return {
    id: session.id,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    capacity: session.capacity,
    availableCapacity: availability.available_capacity_units,
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      durationMinutes: product.duration_minutes,
      minParticipants: product.min_participants,
      maxParticipants: product.max_participants,
    },
    venue: {
      id: venue.id,
      name: venue.name,
      city: venue.city,
      addressLine1: venue.address_line_1,
      timezone: venue.timezone,
    },
    ticketTypes: product.ticket_types
      .filter((ticket) => ticket.is_active)
      .map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        priceAmount: Number(ticket.price_amount),
        currency: ticket.currency,
        capacityUnits: ticket.capacity_units,
        minQuantity: ticket.min_quantity_per_order,
        maxQuantity: ticket.max_quantity_per_order,
      })),
  } satisfies TicketingCheckoutSession
}

export async function listCheckoutSessions() {
  if (!isSupabaseConfigured) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from("sessions")
    .select(publicSessionSelect)
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(24)

  if (error || !data) return []

  const sessions = data as unknown as RawSession[]
  const availabilities = await Promise.all(
    sessions.map((session) => getAvailability(supabase, session.id)),
  )

  return sessions.flatMap((session, index) => {
    const availability = availabilities[index]
    if (
      !availability ||
      !availability.is_sellable ||
      availability.available_capacity_units < 1
    ) return []

    const tickets = session.products.ticket_types.filter((ticket) => ticket.is_active)
    const firstTicket = tickets[0]
    const priceFrom = tickets.length
      ? Math.min(...tickets.map((ticket) => Number(ticket.price_amount)))
      : null

    return [{
      id: session.id,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      availableCapacity: availability.available_capacity_units,
      productName: session.products.name,
      venueName: session.products.venues.name,
      city: session.products.venues.city,
      timezone: session.products.venues.timezone,
      priceFrom,
      currency: firstTicket?.currency ?? "PLN",
    } satisfies TicketingSessionListItem]
  })
}

export async function getCheckoutOrderSummary(
  orderId: string,
  holdToken: string,
) {
  if (!isSupabaseAdminConfigured) return null

  const supabase = createAdminClient()
  const { data: hold, error: holdError } = await supabase
    .from("inventory_holds")
    .select("status, expires_at")
    .eq("order_id", orderId)
    .eq("hold_token", holdToken)
    .single()

  if (holdError || !hold) return null

  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        customer_name,
        customer_email,
        total_amount,
        currency,
        expires_at,
        created_at,
        venues!inner (name, timezone)
      `)
      .eq("id", orderId)
      .single(),
    supabase
      .from("order_items")
      .select(`
        id,
        product_name,
        ticket_type_name,
        quantity,
        unit_price_amount,
        total_price_amount,
        sessions!inner (starts_at)
      `)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ])

  if (orderResult.error || !orderResult.data || itemsResult.error) return null

  const order = orderResult.data as unknown as {
    id: string
    order_number: number
    status: string
    payment_status: string
    customer_name: string
    customer_email: string
    total_amount: number | string
    currency: string
    expires_at: string | null
    created_at: string
    venues: { name: string; timezone: string }
  }
  const items = (itemsResult.data ?? []) as unknown as Array<{
    id: string
    product_name: string
    ticket_type_name: string
    quantity: number
    unit_price_amount: number | string
    total_price_amount: number | string
    sessions: { starts_at: string }
  }>

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    totalAmount: Number(order.total_amount),
    currency: order.currency,
    expiresAt: order.expires_at,
    createdAt: order.created_at,
    holdStatus: hold.status,
    holdExpiresAt: hold.expires_at,
    venueName: order.venues.name,
    venueTimezone: order.venues.timezone,
    items: items.map((item) => ({
      id: item.id,
      productName: item.product_name,
      ticketTypeName: item.ticket_type_name,
      quantity: item.quantity,
      unitPriceAmount: Number(item.unit_price_amount),
      totalPriceAmount: Number(item.total_price_amount),
      startsAt: item.sessions.starts_at,
    })),
  } satisfies CheckoutOrderSummary
}
