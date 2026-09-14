import { NextResponse } from "next/server"

import { releaseEligibleMarketplaceSettlements } from "@/lib/marketplace/settlements"
import { isStripeConnectEnabled } from "@/lib/stripe-connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isStripeConnectEnabled) {
    return NextResponse.json({ ok: true, skipped: "stripe_connect_disabled" })
  }

  try {
    const result = await releaseEligibleMarketplaceSettlements(250)
    return NextResponse.json({ ok: true, ...result, finishedAt: new Date().toISOString() })
  } catch (error) {
    console.error("Marketplace settlement release cron failed", error)
    return NextResponse.json({ error: "Settlement release failed" }, { status: 500 })
  }
}
