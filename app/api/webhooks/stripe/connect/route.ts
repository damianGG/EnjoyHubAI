import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { z } from "zod"

import { applyMarketplacePayoutEvent } from "@/lib/marketplace/settlements"
import { getRequestId, reportServerError } from "@/lib/monitoring/server"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  getStripeClient,
  isStripeConfigured,
  isStripeConnectWebhookConfigured,
} from "@/lib/stripe"
import { syncStripeConnectAccount } from "@/lib/stripe-connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()
const route = "/api/webhooks/stripe/connect"

export async function POST(request: Request) {
  const requestId = getRequestId(request) ?? request.headers.get("x-vercel-id")

  if (!isSupabaseAdminConfigured || !isStripeConfigured || !isStripeConnectWebhookConfigured) {
    reportServerError(new Error("Stripe Connect webhook is not configured"), {
      area: "payments",
      operation: "stripe_connect_webhook_configuration",
      route,
      requestId,
    })
    return NextResponse.json({ error: "Connect webhook is not configured" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!,
    )
  } catch {
    // Invalid signatures are expected internet noise and should not create Sentry incidents.
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "account.updated":
        return await handleAccountUpdated(event)
      case "payout.created":
      case "payout.updated":
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled":
        return await handlePayoutEvent(event)
      default:
        return NextResponse.json({ received: true, handled: false })
    }
  } catch (error) {
    reportServerError(error, {
      area: "payments",
      operation: "stripe_connect_webhook_processing",
      route,
      requestId,
      extras: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        connectedAccount: typeof event.account === "string" ? event.account : null,
        stripeLivemode: event.livemode,
      },
    })
    return NextResponse.json({ error: "Connect webhook processing failed" }, { status: 500 })
  }
}

async function handleAccountUpdated(event: Stripe.AccountUpdatedEvent) {
  const account = event.data.object
  const supabase = createAdminClient()
  const { data: stored, error: lookupError } = await supabase
    .from("organization_payment_accounts")
    .select("organization_id")
    .eq("provider_account_id", account.id)
    .maybeSingle()

  if (lookupError) throw lookupError

  const metadataOrganizationId = account.metadata?.organization_id
  const organizationId = stored?.organization_id ??
    (metadataOrganizationId && uuidSchema.safeParse(metadataOrganizationId).success
      ? metadataOrganizationId
      : null)

  if (!organizationId) {
    console.warn(JSON.stringify({
      level: "warning",
      message: "Ignoring Stripe account update without EnjoyHub organization",
      area: "payments",
      operation: "stripe_connect_account_unmapped",
      accountId: account.id,
    }))
    return NextResponse.json({ received: true, handled: false })
  }

  const state = await syncStripeConnectAccount(organizationId, account.id)
  return NextResponse.json({ received: true, handled: true, ready: state.ready })
}

async function handlePayoutEvent(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout

  // Express users can have other Stripe payouts unrelated to the EnjoyHub
  // settlement button. Only mutate our ledger for payouts we created.
  if (!payout.metadata?.enjoyhub_payout_id) {
    return NextResponse.json({ received: true, handled: false })
  }

  const status = payout.status === "paid"
    ? "paid"
    : payout.status === "failed"
      ? "failed"
      : payout.status === "canceled"
        ? "cancelled"
        : "pending"

  await applyMarketplacePayoutEvent(
    payout.id,
    status,
    status === "paid" ? new Date(event.created * 1000).toISOString() : null,
    payout.failure_code ?? null,
  )

  if (status === "failed") {
    reportServerError(new Error("EnjoyHub organizer payout failed"), {
      area: "payments",
      operation: "organizer_payout_failed",
      route,
      extras: {
        payoutId: payout.id,
        marketplacePayoutId: payout.metadata.enjoyhub_payout_id,
        failureCode: payout.failure_code ?? null,
      },
    })
  }

  return NextResponse.json({ received: true, handled: true })
}
