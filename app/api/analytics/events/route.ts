import { NextResponse } from "next/server"
import { z } from "zod"

import {
  applyAnalyticsCookies,
  readAnalyticsRequestContext,
  recordAnalyticsEvent,
  searchContainsAttraction,
} from "@/lib/analytics/server"
import { createClient } from "@/lib/supabase/server"
import { isSameOriginRequest } from "@/lib/ticketing/security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const uuid = z.string().uuid().optional().nullable()
const eventSchema = z.object({
  eventName: z.enum(["attraction_viewed", "availability_viewed", "checkout_started"]),
  analyticsSessionId: uuid,
  attractionId: uuid,
  productId: uuid,
  ticketingSessionId: uuid,
  source: z.string().trim().max(120).optional().nullable(),
  medium: z.string().trim().max(120).optional().nullable(),
  campaign: z.string().trim().max(160).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  path: z.string().trim().max(500).optional().nullable(),
  properties: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 })
  }

  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe zdarzenie." }, { status: 400 })
  }

  if (JSON.stringify(parsed.data.properties ?? {}).length > 8_000) {
    return NextResponse.json({ error: "Za duży kontekst zdarzenia." }, { status: 413 })
  }

  const input = parsed.data
  const cookieContext = readAnalyticsRequestContext(request)
  const context = {
    ...cookieContext,
    analyticsSessionId: input.analyticsSessionId ?? cookieContext.analyticsSessionId,
    source: input.source || cookieContext.source,
    medium: input.medium || cookieContext.medium,
    campaign: input.campaign || cookieContext.campaign,
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (
    input.eventName === "attraction_viewed" &&
    input.attractionId &&
    context.searchId &&
    await searchContainsAttraction(context.searchId, input.attractionId)
  ) {
    await recordAnalyticsEvent({
      eventName: "search_result_clicked",
      anonymousId: context.anonymousId,
      userId: user?.id ?? null,
      analyticsSessionId: context.analyticsSessionId,
      searchId: context.searchId,
      attractionId: input.attractionId,
      source: context.source,
      medium: context.medium,
      campaign: context.campaign,
      referrer: input.referrer,
      path: input.path,
      dedupeKey: `search_click:${context.searchId}:${input.attractionId}:${context.analyticsSessionId || context.anonymousId}`,
    })
  }

  if (input.eventName === "checkout_started" && input.ticketingSessionId) {
    await recordAnalyticsEvent({
      eventName: "session_selected",
      anonymousId: context.anonymousId,
      userId: user?.id ?? null,
      analyticsSessionId: context.analyticsSessionId,
      searchId: context.searchId,
      ticketingSessionId: input.ticketingSessionId,
      source: context.source,
      medium: context.medium,
      campaign: context.campaign,
      referrer: input.referrer,
      path: input.path,
      dedupeKey: `session_selected:${input.ticketingSessionId}:${context.analyticsSessionId || context.anonymousId}`,
    })
  }

  await recordAnalyticsEvent({
    eventName: input.eventName,
    anonymousId: context.anonymousId,
    userId: user?.id ?? null,
    analyticsSessionId: context.analyticsSessionId,
    searchId: context.searchId,
    attractionId: input.attractionId,
    productId: input.productId,
    ticketingSessionId: input.ticketingSessionId,
    source: context.source,
    medium: context.medium,
    campaign: context.campaign,
    referrer: input.referrer,
    path: input.path,
    properties: input.properties ?? {},
    dedupeKey: input.eventName === "checkout_started" && input.ticketingSessionId
      ? `checkout_started:${input.ticketingSessionId}:${context.analyticsSessionId || context.anonymousId}`
      : null,
  })

  const response = new NextResponse(null, { status: 202 })
  applyAnalyticsCookies(response, context)
  return response
}
