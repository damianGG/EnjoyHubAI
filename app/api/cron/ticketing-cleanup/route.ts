import { NextResponse } from "next/server"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const [holdsResult, limitsResult] = await Promise.all([
    supabase.rpc("ticketing_expire_inventory_holds", { p_limit: 1000 }),
    supabase
      .from("ticketing_checkout_rate_limits")
      .delete({ count: "exact" })
      .lt("expires_at", now),
  ])

  if (holdsResult.error || limitsResult.error) {
    console.error("Ticketing cleanup error", {
      holds: holdsResult.error,
      limits: limitsResult.error,
    })
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    expiredHolds: holdsResult.data ?? 0,
    deletedRateLimits: limitsResult.count ?? 0,
    finishedAt: now,
  })
}
