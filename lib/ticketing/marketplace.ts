import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export interface MarketplaceTicketingVenue {
  id: string
  name: string
  timezone: string
}

export interface MarketplaceTicketingSession {
  id: string
  productId: string
  productName: string
  startsAt: string
  endsAt: string
  localDate: string
  localStartTime: string
  localEndTime: string
  availableCapacity: number
  priceFrom: number
  currency: string
  venueTimezone: string
}

interface RawMarketplaceSession {
  session_id: string
  product_id: string
  product_name: string
  starts_at: string
  ends_at: string
  local_date: string
  local_start_time: string
  local_end_time: string
  available_capacity_units: number
  price_from: number | string
  currency: string
  venue_timezone: string
}

function isMissingMarketplaceBridge(error: { code?: string; message?: string }) {
  return error.code === "PGRST202"
    || error.code === "42703"
    || error.message?.includes("ticketing_list_property_sessions")
    || error.message?.includes("property_id")
}

export async function getMarketplaceTicketingVenue(
  propertyId: string,
): Promise<MarketplaceTicketingVenue | null> {
  if (!isSupabaseConfigured || !isTicketingCheckoutEnabled) return null

  const supabase = createClient()
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, timezone")
    .eq("property_id", propertyId)
    .eq("status", "active")
    .maybeSingle()

  if (error || !data) {
    if (error && !isMissingMarketplaceBridge(error)) {
      console.error("Marketplace venue lookup failed", {
        code: error.code,
        message: error.message,
      })
    }
    return null
  }

  return {
    id: data.id,
    name: data.name,
    timezone: data.timezone,
  }
}

export async function listMarketplacePropertySessions(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<MarketplaceTicketingSession[]> {
  if (!isSupabaseConfigured || !isTicketingCheckoutEnabled) return []

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    "ticketing_list_property_sessions",
    {
      p_property_id: propertyId,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  )

  if (error || !data) {
    if (error && !isMissingMarketplaceBridge(error)) {
      console.error("Marketplace session lookup failed", {
        code: error.code,
        message: error.message,
      })
    }
    return []
  }

  return (data as RawMarketplaceSession[]).map((session) => ({
    id: session.session_id,
    productId: session.product_id,
    productName: session.product_name,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    localDate: session.local_date,
    localStartTime: session.local_start_time,
    localEndTime: session.local_end_time,
    availableCapacity: session.available_capacity_units,
    priceFrom: Number(session.price_from),
    currency: session.currency,
    venueTimezone: session.venue_timezone,
  }))
}
