import type Stripe from "stripe"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe"

export interface PreparedMarketplaceRefund {
  prepared_refund_id: string
  prepared_payment_attempt_id: string
  prepared_provider_payment_id: string
  prepared_provider_transfer_id: string | null
  prepared_amount_minor: number | string
  prepared_currency: string
  prepared_recovery_required_minor: number | string
}

export async function executePreparedMarketplaceRefund(prepared: PreparedMarketplaceRefund) {
  if (!isSupabaseAdminConfigured || !isStripeConfigured) {
    throw new Error("Stripe or Supabase admin is not configured")
  }

  const stripe = getStripeClient()
  const amountMinor = Number(prepared.prepared_amount_minor)

  try {
    const refund = await stripe.refunds.create({
      payment_intent: prepared.prepared_provider_payment_id,
      amount: amountMinor,
      reason: "requested_by_customer",
      metadata: {
        enjoyhub_refund_id: prepared.prepared_refund_id,
        payment_attempt_id: prepared.prepared_payment_attempt_id,
      },
    }, {
      idempotencyKey: `enjoyhub-refund-${prepared.prepared_refund_id}`,
    })

    await applyStripeRefund(refund, prepared.prepared_refund_id)
    if (normalizeRefundStatus(refund.status) === "succeeded") {
      await recoverOrganizerShare(prepared.prepared_refund_id)
    }

    return {
      refundId: prepared.prepared_refund_id,
      providerRefundId: refund.id,
      status: normalizeRefundStatus(refund.status),
      amountMinor,
      currency: prepared.prepared_currency,
    }
  } catch (error) {
    if (isDefinitelyRejectedStripeRequest(error)) {
      const supabase = createAdminClient()
      await supabase.rpc("marketplace_fail_refund_creation", {
        p_refund_id: prepared.prepared_refund_id,
        p_failure_code: stripeFailureCode(error),
      })
    }
    throw error
  }
}

export async function syncMarketplaceRefundFromStripe(refund: Stripe.Refund) {
  const refundId = refund.metadata?.enjoyhub_refund_id
  if (!refundId) return { handled: false }

  await applyStripeRefund(refund, refundId)
  if (normalizeRefundStatus(refund.status) === "succeeded") {
    await recoverOrganizerShare(refundId)
  }

  return { handled: true, refundId, status: normalizeRefundStatus(refund.status) }
}

export async function recoverOrganizerShare(refundId: string) {
  if (!isSupabaseAdminConfigured || !isStripeConfigured) {
    throw new Error("Stripe or Supabase admin is not configured")
  }

  const supabase = createAdminClient()
  const { data: refund, error } = await supabase
    .from("payment_refunds")
    .select("id, status, recovery_status, recovery_required_minor, provider_transfer_id")
    .eq("id", refundId)
    .single()

  if (error || !refund) throw new Error(error?.message ?? "Refund not found for organizer recovery")

  const recoveryRequiredMinor = Number(refund.recovery_required_minor)
  if (refund.status !== "succeeded" || recoveryRequiredMinor <= 0 || refund.recovery_status === "reversed") {
    return { recovered: false, skipped: true }
  }

  if (!refund.provider_transfer_id) {
    await applyRecoveryState(refundId, null, "requires_review", "missing_provider_transfer")
    return { recovered: false, review: true }
  }

  const stripe = getStripeClient()
  try {
    const reversal = await stripe.transfers.createReversal(
      refund.provider_transfer_id,
      {
        amount: recoveryRequiredMinor,
        metadata: { enjoyhub_refund_id: refundId },
      },
      { idempotencyKey: `enjoyhub-refund-reversal-${refundId}` },
    )

    await applyRecoveryState(refundId, reversal.id, "reversed", null)
    return { recovered: true, reversalId: reversal.id }
  } catch (error) {
    const failureCode = stripeFailureCode(error)
    if (isDefinitelyRejectedStripeRequest(error)) {
      await applyRecoveryState(refundId, null, "debt", failureCode)
      return { recovered: false, debt: true, failureCode }
    }

    // Network/API uncertainty is intentionally not treated as confirmed debt:
    // the deterministic Stripe idempotency key makes a later manual retry safe.
    await applyRecoveryState(refundId, null, "requires_review", failureCode)
    return { recovered: false, review: true, failureCode }
  }
}

async function applyStripeRefund(refund: Stripe.Refund, refundId: string) {
  if (!isSupabaseAdminConfigured) throw new Error("Supabase admin is not configured")

  const supabase = createAdminClient()
  const status = normalizeRefundStatus(refund.status)
  const { error } = await supabase.rpc("marketplace_apply_refund_provider", {
    p_refund_id: refundId,
    p_provider_refund_id: refund.id,
    p_status: status,
    p_failure_code: refundFailureReason(refund),
  })
  if (error) throw new Error(error.message)
}

async function applyRecoveryState(
  refundId: string,
  providerTransferReversalId: string | null,
  status: "reversed" | "debt" | "requires_review",
  failureCode: string | null,
) {
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("marketplace_apply_refund_recovery", {
    p_refund_id: refundId,
    p_provider_transfer_reversal_id: providerTransferReversalId,
    p_status: status,
    p_failure_code: failureCode,
  })
  if (error) throw new Error(error.message)
}

function normalizeRefundStatus(status: string | null) {
  if (status === "succeeded") return "succeeded" as const
  if (status === "failed") return "failed" as const
  if (status === "canceled" || status === "cancelled") return "cancelled" as const
  return "pending" as const
}

function refundFailureReason(refund: Stripe.Refund) {
  return (refund as Stripe.Refund & { failure_reason?: string | null }).failure_reason ?? null
}

function stripeFailureCode(error: unknown) {
  const stripeError = error as { type?: string; code?: string; decline_code?: string; message?: string }
  return stripeError.code ?? stripeError.decline_code ?? stripeError.type ?? stripeError.message ?? "stripe_error"
}

function isDefinitelyRejectedStripeRequest(error: unknown) {
  const type = (error as { type?: string }).type
  if (!type) return false
  return !["StripeAPIError", "StripeConnectionError", "StripeRateLimitError"].includes(type)
}
