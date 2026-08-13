import { createHash } from "node:crypto"

import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { z } from "zod"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  getStripeClient,
  isStripeConfigured,
  isStripeWebhookConfigured,
} from "@/lib/stripe"

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

  // Signature verification requires the exact raw payload. Do not call json().
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

      default:
        return NextResponse.json({ received: true, handled: false })
    }
  } catch (error) {
    console.error("Stripe webhook processing error", {
      eventId: event.id,
      eventType: event.type,
      error,
    })
    // A 5xx response makes Stripe retry transient database or network failures.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handleSuccessfulCheckout(
  event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent,
  payloadHash: string,
) {
  const session = event.data.object

  // Some asynchronous methods emit completed before funds are available. Only
  // paid sessions may convert inventory and issue admission tickets.
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

function getExpandableId(
  value: string | Stripe.PaymentIntent | null,
) {
  if (typeof value === "string") return value
  return value?.id ?? ""
}
