import { randomUUID } from "node:crypto"

import type { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

export const ANALYTICS_ANON_COOKIE = "eh_anon_id"
export const ANALYTICS_SESSION_COOKIE = "eh_analytics_session_id"
export const ANALYTICS_SEARCH_COOKIE = "eh_search_id"
export const ANALYTICS_SOURCE_COOKIE = "eh_source"
export const ANALYTICS_MEDIUM_COOKIE = "eh_medium"
export const ANALYTICS_CAMPAIGN_COOKIE = "eh_campaign"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AnalyticsEventName =
  | "search_performed"
  | "search_result_clicked"
  | "attraction_viewed"
  | "availability_viewed"
  | "session_selected"
  | "checkout_started"
  | "order_created"
  | "payment_started"
  | "payment_completed"
  | "ticket_redeemed"
  | "review_submitted"
  | "demand_created"
  | "demand_notified"
  | "demand_converted"
  | "refund_requested"
  | "refund_completed"

export interface AnalyticsRequestContext {
  anonymousId: string
  analyticsSessionId: string | null
  searchId: string | null
  source: string | null
  medium: string | null
  campaign: string | null
}

interface RecordAnalyticsInput {
  eventName: AnalyticsEventName
  occurredAt?: string | null
  anonymousId?: string | null
  userId?: string | null
  analyticsSessionId?: string | null
  searchId?: string | null
  attractionId?: string | null
  productId?: string | null
  ticketingSessionId?: string | null
  orderId?: string | null
  source?: string | null
  medium?: string | null
  campaign?: string | null
  referrer?: string | null
  path?: string | null
  valueAmount?: number | null
  currency?: string | null
  properties?: Record<string, unknown>
  dedupeKey?: string | null
  searchResults?: Array<{ attractionId: string; position: number }>
}

function parseCookieHeader(request: Request) {
  const raw = request.headers.get("cookie") || ""
  const values = new Map<string, string>()
  for (const item of raw.split(";")) {
    const separator = item.indexOf("=")
    if (separator < 1) continue
    const key = item.slice(0, separator).trim()
    const value = item.slice(separator + 1).trim()
    try {
      values.set(key, decodeURIComponent(value))
    } catch {
      values.set(key, value)
    }
  }
  return values
}

function safeUuid(value: string | null | undefined) {
  return value && UUID_RE.test(value) ? value : null
}

function safeText(value: string | null | undefined, max = 160) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function safeReferrer(value: string | null | undefined) {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return `${parsed.origin}${parsed.pathname}`.slice(0, 500)
  } catch {
    return null
  }
}

export function readAnalyticsRequestContext(request: Request): AnalyticsRequestContext {
  const cookies = parseCookieHeader(request)
  return {
    anonymousId: safeUuid(cookies.get(ANALYTICS_ANON_COOKIE)) || randomUUID(),
    analyticsSessionId: safeUuid(cookies.get(ANALYTICS_SESSION_COOKIE)),
    searchId: safeUuid(cookies.get(ANALYTICS_SEARCH_COOKIE)),
    source: safeText(cookies.get(ANALYTICS_SOURCE_COOKIE), 120),
    medium: safeText(cookies.get(ANALYTICS_MEDIUM_COOKIE), 120),
    campaign: safeText(cookies.get(ANALYTICS_CAMPAIGN_COOKIE), 160),
  }
}

export function applyAnalyticsCookies(
  response: NextResponse,
  context: Partial<AnalyticsRequestContext>,
  options?: { searchMaxAgeSeconds?: number },
) {
  const common = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  }

  if (safeUuid(context.anonymousId)) {
    response.cookies.set(ANALYTICS_ANON_COOKIE, context.anonymousId!, {
      ...common,
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60,
    })
  }
  if (safeUuid(context.analyticsSessionId)) {
    response.cookies.set(ANALYTICS_SESSION_COOKIE, context.analyticsSessionId!, {
      ...common,
      httpOnly: true,
      maxAge: 24 * 60 * 60,
    })
  }
  if (safeUuid(context.searchId)) {
    response.cookies.set(ANALYTICS_SEARCH_COOKIE, context.searchId!, {
      ...common,
      httpOnly: true,
      maxAge: options?.searchMaxAgeSeconds ?? 30 * 60,
    })
  }
  if (safeText(context.source, 120)) {
    response.cookies.set(ANALYTICS_SOURCE_COOKIE, context.source!, { ...common, httpOnly: true, maxAge: 30 * 24 * 60 * 60 })
  }
  if (safeText(context.medium, 120)) {
    response.cookies.set(ANALYTICS_MEDIUM_COOKIE, context.medium!, { ...common, httpOnly: true, maxAge: 30 * 24 * 60 * 60 })
  }
  if (safeText(context.campaign, 160)) {
    response.cookies.set(ANALYTICS_CAMPAIGN_COOKIE, context.campaign!, { ...common, httpOnly: true, maxAge: 30 * 24 * 60 * 60 })
  }
}

export async function recordAnalyticsEvent(input: RecordAnalyticsInput) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("analytics_record_event", {
      p_event_name: input.eventName,
      p_occurred_at: input.occurredAt ?? new Date().toISOString(),
      p_anonymous_id: safeUuid(input.anonymousId),
      p_user_id: safeUuid(input.userId),
      p_analytics_session_id: safeUuid(input.analyticsSessionId),
      p_search_id: safeUuid(input.searchId),
      p_attraction_id: safeUuid(input.attractionId),
      p_product_id: safeUuid(input.productId),
      p_ticketing_session_id: safeUuid(input.ticketingSessionId),
      p_order_id: safeUuid(input.orderId),
      p_source: safeText(input.source, 120),
      p_medium: safeText(input.medium, 120),
      p_campaign: safeText(input.campaign, 160),
      p_referrer: safeReferrer(input.referrer),
      p_path: safeText(input.path, 500),
      p_value_amount: input.valueAmount ?? null,
      p_currency: input.currency?.toUpperCase().slice(0, 3) ?? null,
      p_properties: input.properties ?? {},
      p_dedupe_key: safeText(input.dedupeKey, 300),
      p_search_results: input.searchResults ?? [],
    })
    if (error) {
      console.error("Analytics event persistence failed", { eventName: input.eventName, code: error.code, message: error.message })
      return null
    }
    return data as string | null
  } catch (error) {
    console.error("Analytics event persistence failed", { eventName: input.eventName, error })
    return null
  }
}

export async function enrichAnalyticsEvent(
  dedupeKey: string,
  context: AnalyticsRequestContext & { userId?: string | null; referrer?: string | null; path?: string | null },
) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.rpc("analytics_enrich_event", {
      p_dedupe_key: dedupeKey,
      p_anonymous_id: safeUuid(context.anonymousId),
      p_user_id: safeUuid(context.userId),
      p_analytics_session_id: safeUuid(context.analyticsSessionId),
      p_search_id: safeUuid(context.searchId),
      p_source: safeText(context.source, 120),
      p_medium: safeText(context.medium, 120),
      p_campaign: safeText(context.campaign, 160),
      p_referrer: safeReferrer(context.referrer),
      p_path: safeText(context.path, 500),
    })
    if (error) console.error("Analytics enrichment failed", { dedupeKey, code: error.code, message: error.message })
  } catch (error) {
    console.error("Analytics enrichment failed", { dedupeKey, error })
  }
}

export async function searchContainsAttraction(searchId: string | null, attractionId: string | null) {
  if (!safeUuid(searchId) || !safeUuid(attractionId)) return false
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("analytics_search_results")
    .select("position")
    .eq("search_id", searchId!)
    .eq("attraction_id", attractionId!)
    .maybeSingle()
  return !error && Boolean(data)
}
