import type Stripe from "stripe"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe"

export const isStripeConnectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"

const configuredMaxHoldDays = Number(process.env.STRIPE_CONNECT_MAX_HOLD_DAYS ?? "85")
export const stripeConnectMaxHoldDays = Number.isFinite(configuredMaxHoldDays)
  ? Math.min(89, Math.max(1, Math.trunc(configuredMaxHoldDays)))
  : 85

export function stripeTransferGroup(orderId: string) {
  return `ENJOYHUB_ORDER_${orderId}`
}

export interface StripeConnectAccountState {
  organizationId: string
  accountId: string
  detailsSubmitted: boolean
  chargesEnabled: boolean
  cardPaymentsEnabled: boolean
  transfersEnabled: boolean
  payoutsEnabled: boolean
  payoutScheduleManual: boolean
  requirementsCurrentlyDue: string[]
  disabledReason: string | null
  ready: boolean
}

function asStripeAccount(value: Stripe.Account | Stripe.DeletedAccount) {
  if ("deleted" in value && value.deleted) {
    throw new Error("Połączone konto Stripe zostało usunięte")
  }
  return value as Stripe.Account
}

export async function setStripeConnectManualPayoutSchedule(accountId: string) {
  if (!isStripeConfigured) throw new Error("Stripe nie jest skonfigurowany")

  const stripe = getStripeClient()
  await stripe.balanceSettings.update(
    {
      payments: {
        payouts: {
          schedule: { interval: "manual" },
        },
      },
    },
    { stripeAccount: accountId },
  )
}

export async function syncStripeConnectAccount(
  organizationId: string,
  accountId: string,
): Promise<StripeConnectAccountState> {
  if (!isStripeConfigured || !isSupabaseAdminConfigured) {
    throw new Error("Stripe Connect lub Supabase nie są skonfigurowane")
  }

  const stripe = getStripeClient()
  let account = asStripeAccount(await stripe.accounts.retrieve(accountId))

  let balanceSettings = await stripe.balanceSettings.retrieve({}, { stripeAccount: accountId })
  let payoutScheduleManual = balanceSettings.payments?.payouts?.schedule?.interval === "manual"

  // EnjoyHub controls the bank payout moment. If the account is already usable
  // but Stripe has a rolling schedule, switch it to manual before enabling sales.
  if (!payoutScheduleManual) {
    try {
      await setStripeConnectManualPayoutSchedule(accountId)
      balanceSettings = await stripe.balanceSettings.retrieve({}, { stripeAccount: accountId })
      payoutScheduleManual = balanceSettings.payments?.payouts?.schedule?.interval === "manual"
      account = asStripeAccount(await stripe.accounts.retrieve(accountId))
    } catch (error) {
      console.warn("Could not set connected account payout schedule to manual yet", {
        organizationId,
        accountId,
        error,
      })
    }
  }

  const detailsSubmitted = account.details_submitted === true
  const chargesEnabled = account.charges_enabled === true
  const cardPaymentsEnabled = account.capabilities?.card_payments === "active"
  const transfersEnabled = account.capabilities?.transfers === "active"
  const payoutsEnabled = account.payouts_enabled === true
  const requirementsCurrentlyDue = account.requirements?.currently_due ?? []
  const disabledReason = account.requirements?.disabled_reason ?? null
  const ready = detailsSubmitted &&
    chargesEnabled &&
    cardPaymentsEnabled &&
    transfersEnabled &&
    payoutsEnabled &&
    payoutScheduleManual

  const supabase = createAdminClient()
  const syncedAt = new Date().toISOString()
  const { error: accountError } = await supabase
    .from("organization_payment_accounts")
    .upsert({
      organization_id: organizationId,
      provider: "stripe",
      provider_account_id: accountId,
      details_submitted: detailsSubmitted,
      charges_enabled: chargesEnabled,
      card_payments_enabled: cardPaymentsEnabled,
      transfers_enabled: transfersEnabled,
      payouts_enabled: payoutsEnabled,
      payout_schedule_manual: payoutScheduleManual,
      disabled_reason: disabledReason,
      requirements_currently_due: requirementsCurrentlyDue,
      last_synced_at: syncedAt,
    }, { onConflict: "organization_id" })

  if (accountError) {
    throw new Error(`Nie udało się zapisać statusu Stripe Connect: ${accountError.message}`)
  }

  // Stripe KYC becomes the source of truth for payment readiness once Connect
  // is enabled. This preserves the existing ticketing_order_payment_allowed RPC.
  const verificationStatus = ready
    ? "verified"
    : detailsSubmitted
      ? "pending"
      : "not_started"

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({
      verification_status: verificationStatus,
      payments_enabled: ready,
      verification_submitted_at: detailsSubmitted ? syncedAt : null,
      verified_at: ready ? syncedAt : null,
    })
    .eq("id", organizationId)

  if (organizationError) {
    throw new Error(`Nie udało się zaktualizować gotowości organizacji: ${organizationError.message}`)
  }

  return {
    organizationId,
    accountId,
    detailsSubmitted,
    chargesEnabled,
    cardPaymentsEnabled,
    transfersEnabled,
    payoutsEnabled,
    payoutScheduleManual,
    requirementsCurrentlyDue,
    disabledReason,
    ready,
  }
}
