import { createHash } from "node:crypto"

import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { z } from "zod"

import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation"
import { syncMarketplaceRefundFromStripe } from "@/lib/marketplace/refunds"
import { recordMarketplaceSettlement } from "@/lib/marketplace/settlements"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  getStripeClient,
  isStripeConfigured,
  isStripeWebhookConfigured,
} from "@/lib/stripe"
import { isStripeConnectEnabled } from "@/lib/stripe-connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured || !isStripeConfigured || !isStripeWebhookConfigured) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  const rawBody = await request.text()
  const payloadHash = createHash("sha256").update(rawBody).digest("hex")

  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (error) {
    console.warn("Rejected Stripe webhook signature", error)
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        return await handleSuccessfulCheckout(event, payloadHash)

      case "checkout.session.expired":
        return await handleClosedCheckout(event, payloadHash, "expired")

      case "checkout.session.async_payment_failed":
        return await handleClosedCheckout(event, payloadHash, "failed")

      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        return await handleRefundEvent(event)

      default:
        return NextResponse.json({ received: true, handled: false })
    }
  } catch (error) {
    console.error("Stripe webhook processing error", {
      eventId: event.id,
      eventType: event.type,
      error,
    })
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handleSuccessfulCheckout(
  event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent,
  payloadHash: string,
) {
  const session = event.data.object

  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, handled: false, waitingForPayment: true })
  }

  const attemptId = session.metadata?.payment_attempt_id
  if (!attemptId || !uuidSchema.safeParse(attemptId).success) {
    throw new Error("Stripe Checkout metadata has no valid payment attempt ID")
  }

  if (session.amount_total === null || !session.currency) {
    throw new Error("Stripe Checkout Session has no settled amount")
  }

  const paymentIntentId = getExpandableId(session.payment_intent)
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("ticketing_confirm_provider_payment", {
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_sha256: payloadHash,
    p_payment_attempt_id: attemptId,
    p_provider_checkout_id: session.id,
    p_provider_payment_id: paymentIntentId,
    p_amount_minor: session.amount_total,
    p_currency: session.currency,
    p_paid_at: new Date(event.created * 1000).toISOString(),
    p_payment_metadata: {
      event_type: event.type,
      livemode: event.livemode,
      payment_status: session.payment_status,
    },
  })

  if (error || !data?.[0]) {
    throw new Error(error?.message ?? "Payment fulfillment returned no result")
  }

  const result = data[0] as {
    current_order_status: string
    current_payment_status: string
    issued_ticket_count: number
    event_was_duplicate: boolean
  }
  const fulfilled = result.current_order_status === "confirmed" &&
    result.current_payment_status === "paid"

  if (!fulfilled) {
    console.error("Paid Stripe Checkout requires manual inventory review", {
      eventId: event.id,
      checkoutSessionId: session.id,
      paymentAttemptId: attemptId,
    })
  }

  let orderId: string | null = null
  if (fulfilled) {
    const { data: attempt, error: attemptError } = await supabase
      .from("payment_attempts")
      .select("order_id")
      .eq("id", attemptId)
      .maybeSingle()

    if (attemptError || !attempt?.order_id) {
      throw new Error(attemptError?.message ?? "Could not resolve paid order")
    }
    orderId = attempt.order_id
  }

  if (fulfilled && isStripeConnectEnabled && orderId) {
    if (!paymentIntentId) throw new Error("Paid Stripe Checkout has no PaymentIntent")
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge"] },
    )
    const chargeId = getExpandableId(paymentIntent.latest_charge)
    if (!chargeId) throw new Error("Paid Stripe PaymentIntent has no settled charge")

    await recordMarketplaceSettlement({
      orderId,
      paymentAttemptId: attemptId,
      providerChargeId: chargeId,
      grossAmountMinor: session.amount_total,
      currency: session.currency,
    })
  }

  if (fulfilled && !result.event_was_duplicate && orderId) {
    const emailResult = await sendOrderConfirmationEmail(orderId)
    if (!emailResult.queued) {
      console.error("Paid order confirmation email could not be queued", {
        orderId,
        reason: emailResult.reason,
        error: emailResult.error,
      })
    } else if (!emailResult.sent) {
      console.warn("Paid order confirmation email queued for retry", {
        orderId,
        outboxId: emailResult.outboxId,
        status: emailResult.status,
        error: emailResult.error,
      })
    }
  }

  return NextResponse.json({
    received: true,
    handled: true,
    fulfilled,
    tickets: result.issued_ticket_count,
    duplicate: result.event_was_duplicate,
  })
}

async function handleClosedCheckout(
  event: Stripe.CheckoutSessionExpiredEvent | Stripe.CheckoutSessionAsyncPaymentFailedEvent,
  payloadHash: string,
  terminalStatus: "failed" | "expired",
) {
  const session = event.data.object
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("ticketing_close_provider_payment", {
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_sha256: payloadHash,
    p_provider_checkout_id: session.id,
    p_terminal_status: terminalStatus,
    p_failure_code: event.type,
  })

  if (error || !data?.[0]) {
    throw new Error(error?.message ?? "Payment closure returned no result")
  }

  return NextResponse.json({ received: true, handled: true })
}

async function handleRefundEvent(event: Stripe.Event) {
  const refund = event.data.object as Stripe.Refund
  const result = await syncMarketplaceRefundFromStripe(refund)
  return NextResponse.json({ received: true, ...result })
}

function getExpandableId(
  value: string | { id: string } | null,
) {
  if (typeof value === "string") return value
  return value?.id ?? ""
}
