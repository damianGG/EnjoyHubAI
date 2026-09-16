import { NextResponse } from "next/server"

import { releaseEligibleMarketplaceSettlements } from "@/lib/marketplace/settlements"
import { getRequestId, reportServerError, runMonitoredCron } from "@/lib/monitoring/server"
import { isStripeConnectEnabled } from "@/lib/stripe-connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const route = "/api/cron/settlement-release"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const requestId = getRequestId(request) ?? request.headers.get("x-vercel-id")

  return runMonitoredCron({
    slug: "enjoyhub-settlement-release",
    schedule: "0 4 * * *",
    route,
    maxRuntimeMinutes: 15,
    checkinMarginMinutes: 10,
  }, async () => {
    if (!isStripeConnectEnabled) {
      return NextResponse.json({ ok: true, skipped: "stripe_connect_disabled" })
    }

    try {
      const result = await releaseEligibleMarketplaceSettlements(250)
      return NextResponse.json({ ok: true, ...result, finishedAt: new Date().toISOString() })
    } catch (error) {
      reportServerError(error, {
        area: "settlements",
        operation: "release_eligible_settlements",
        route,
        requestId,
      })
      return NextResponse.json({ error: "Settlement release failed" }, { status: 500 })
    }
  })
}
