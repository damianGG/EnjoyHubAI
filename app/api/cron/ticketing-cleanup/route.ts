import { NextResponse } from "next/server"

import { getRequestId, reportServerError, runMonitoredCron } from "@/lib/monitoring/server"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

const route = "/api/cron/ticketing-cleanup"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const requestId = getRequestId(request) ?? request.headers.get("x-vercel-id")

  return runMonitoredCron({
    slug: "enjoyhub-ticketing-cleanup",
    schedule: "0 3 * * *",
    route,
    maxRuntimeMinutes: 10,
    checkinMarginMinutes: 10,
  }, async () => {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const extensionUntil = new Date()
    extensionUntil.setUTCDate(extensionUntil.getUTCDate() + 90)
    const [holdsResult, limitsResult, sessionsResult] = await Promise.all([
      supabase.rpc("ticketing_expire_inventory_holds", { p_limit: 1000 }),
      supabase
        .from("ticketing_checkout_rate_limits")
        .delete({ count: "exact" })
        .lt("expires_at", now),
      supabase.rpc("ticketing_extend_active_sessions", {
        p_until: extensionUntil.toISOString().slice(0, 10),
        p_limit: 250,
      }),
    ])

    if (holdsResult.error || limitsResult.error) {
      reportServerError(holdsResult.error ?? limitsResult.error, {
        area: "cron",
        operation: "ticketing_cleanup",
        route,
        requestId,
        extras: {
          holdsError: holdsResult.error?.code ?? null,
          limitsError: limitsResult.error?.code ?? null,
        },
      })
      return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
    }

    if (sessionsResult.error) {
      // Session extension is additive and should not block expiry of holds.
      console.warn(JSON.stringify({
        level: "warning",
        message: "Ticketing session extension unavailable",
        area: "cron",
        operation: "ticketing_session_extension",
        route,
        requestId,
        errorCode: sessionsResult.error.code,
      }))
    }

    const extension = sessionsResult.data?.[0] as {
      processed_product_count?: number
      generated_session_count?: number
    } | undefined

    return NextResponse.json({
      ok: true,
      expiredHolds: holdsResult.data ?? 0,
      deletedRateLimits: limitsResult.count ?? 0,
      sessionExtension: sessionsResult.error ? "migration_pending" : "ok",
      processedProducts: extension?.processed_product_count ?? 0,
      generatedSessions: extension?.generated_session_count ?? 0,
      finishedAt: now,
    })
  })
}
