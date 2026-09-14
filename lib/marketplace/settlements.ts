import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe"
import { stripeTransferGroup } from "@/lib/stripe-connect"

interface SettlementInput {
  orderId: string
  paymentAttemptId: string
  providerChargeId: string
  grossAmountMinor: number
  currency: string
}

interface RawOrderForSettlement {
  organization_id: string
  total_amount: number | string
  currency: string
  organizations: { platform_fee_bps: number }
  order_items: Array<{ sessions: { ends_at: string } }>
}

export async function recordMarketplaceSettlement(input: SettlementInput) {
  if (!isSupabaseAdminConfigured) throw new Error("Supabase admin is not configured")

  const supabase = createAdminClient()
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(`
      organization_id,
      total_amount,
      currency,
      organizations!inner (platform_fee_bps),
      order_items!inner (sessions!inner (ends_at))
    `)
    .eq("id", input.orderId)
    .single()

  if (orderError || !orderData) {
    throw new Error(orderError?.message ?? "Order not found for marketplace settlement")
  }

  const order = orderData as unknown as RawOrderForSettlement
  const expectedAmountMinor = Math.round(Number(order.total_amount) * 100)
  const currency = order.currency.toUpperCase()
  if (expectedAmountMinor !== input.grossAmountMinor || currency !== input.currency.toUpperCase()) {
    throw new Error("Paid amount does not match the settlement order")
  }

  const serviceEndsAt = order.order_items
    .map((item) => item.sessions.ends_at)
    .sort()
    .at(-1)
  if (!serviceEndsAt) throw new Error("Order has no service end time")

  const platformFeeBps = order.organizations.platform_fee_bps
  const platformFeeAmountMinor = Math.round(input.grossAmountMinor * platformFeeBps / 10_000)
  const organizerAmountMinor = input.grossAmountMinor - platformFeeAmountMinor
  const settlement = {
    order_id: input.orderId,
    organization_id: order.organization_id,
    payment_attempt_id: input.paymentAttemptId,
    provider: "stripe",
    provider_charge_id: input.providerChargeId,
    transfer_group: stripeTransferGroup(input.orderId),
    currency,
    gross_amount_minor: input.grossAmountMinor,
    platform_fee_bps: platformFeeBps,
    platform_fee_amount_minor: platformFeeAmountMinor,
    organizer_amount_minor: organizerAmountMinor,
    service_ends_at: serviceEndsAt,
    eligible_at: serviceEndsAt,
    status: "pending_service",
  }

  const { data: existing, error: existingError } = await supabase
    .from("marketplace_settlements")
    .select("order_id, payment_attempt_id, provider_charge_id, gross_amount_minor, platform_fee_bps, organizer_amount_minor, currency")
    .eq("order_id", input.orderId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) {
    const matches = existing.payment_attempt_id === input.paymentAttemptId &&
      existing.provider_charge_id === input.providerChargeId &&
      Number(existing.gross_amount_minor) === input.grossAmountMinor &&
      existing.platform_fee_bps === platformFeeBps &&
      Number(existing.organizer_amount_minor) === organizerAmountMinor &&
      existing.currency === currency
    if (!matches) throw new Error("Existing marketplace settlement differs from the paid order")
    return existing
  }

  const { data, error } = await supabase
    .from("marketplace_settlements")
    .insert(settlement)
    .select("id, order_id, status, organizer_amount_minor")
    .single()

  if (error) {
    if (error.code === "23505") return recordMarketplaceSettlement(input)
    throw new Error(error.message)
  }

  return data
}

export async function releaseEligibleMarketplaceSettlements(
  limit = 100,
  organizationId?: string,
) {
  if (!isSupabaseAdminConfigured || !isStripeConfigured) {
    throw new Error("Stripe or Supabase admin is not configured")
  }

  const supabase = createAdminClient()
  const baseQuery = supabase
    .from("marketplace_settlements")
    .select("id, order_id, organization_id, provider_charge_id, transfer_group, organizer_amount_minor, organizer_refunded_before_transfer_minor, refunded_amount_minor, gross_amount_minor, currency")
    .eq("status", "pending_service")
    .lte("eligible_at", new Date().toISOString())
  const scopedQuery = organizationId
    ? baseQuery.eq("organization_id", organizationId)
    : baseQuery
  const { data: settlements, error } = await scopedQuery
    .order("eligible_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!settlements?.length) return { released: 0, skipped: 0, failed: 0 }

  const organizationIds = [...new Set(settlements.map((item) => item.organization_id))]
  const { data: accounts, error: accountError } = await supabase
    .from("organization_payment_accounts")
    .select("organization_id, provider_account_id, transfers_enabled, payouts_enabled, payout_schedule_manual")
    .in("organization_id", organizationIds)

  if (accountError) throw new Error(accountError.message)
  const accountByOrganization = new Map((accounts ?? []).map((account) => [account.organization_id, account]))
  const stripe = getStripeClient()
  let released = 0
  let skipped = 0
  let failed = 0

  for (const settlement of settlements) {
    const account = accountByOrganization.get(settlement.organization_id)
    if (!account?.transfers_enabled || !account.payouts_enabled || !account.payout_schedule_manual) {
      skipped += 1
      continue
    }

    const transferAmountMinor = Math.max(
      Number(settlement.organizer_amount_minor) - Number(settlement.organizer_refunded_before_transfer_minor),
      0,
    )

    if (transferAmountMinor <= 0) {
      if (Number(settlement.refunded_amount_minor) >= Number(settlement.gross_amount_minor)) {
        await supabase
          .from("marketplace_settlements")
          .update({ status: "refunded" })
          .eq("id", settlement.id)
          .eq("status", "pending_service")
      }
      skipped += 1
      continue
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: transferAmountMinor,
        currency: settlement.currency.toLowerCase(),
        destination: account.provider_account_id,
        source_transaction: settlement.provider_charge_id,
        transfer_group: settlement.transfer_group,
        metadata: {
          settlement_id: settlement.id,
          order_id: settlement.order_id,
          organization_id: settlement.organization_id,
        },
      }, {
        idempotencyKey: `enjoyhub-transfer-${settlement.id}`,
      })

      const { error: updateError } = await supabase
        .from("marketplace_settlements")
        .update({
          provider_transfer_id: transfer.id,
          transferred_amount_minor: transferAmountMinor,
          transferred_at: new Date().toISOString(),
          status: "transferred",
        })
        .eq("id", settlement.id)
        .eq("status", "pending_service")

      if (updateError) throw new Error(updateError.message)
      released += 1
    } catch (transferError) {
      failed += 1
      console.error("Marketplace settlement transfer failed", {
        settlementId: settlement.id,
        organizationId: settlement.organization_id,
        error: transferError,
      })
    }
  }

  return { released, skipped, failed }
}

export async function createOrganizerMarketplacePayout(
  organizationId: string,
  requestedBy: string,
  currency = "PLN",
) {
  if (!isSupabaseAdminConfigured || !isStripeConfigured) {
    throw new Error("Stripe or Supabase admin is not configured")
  }

  const supabase = createAdminClient()
  const { data: account, error: accountError } = await supabase
    .from("organization_payment_accounts")
    .select("provider_account_id, transfers_enabled, payouts_enabled, payout_schedule_manual")
    .eq("organization_id", organizationId)
    .single()

  if (accountError || !account) throw new Error("Organizator nie ma połączonego konta Stripe")
  if (!account.transfers_enabled || !account.payouts_enabled || !account.payout_schedule_manual) {
    throw new Error("Konto Stripe nie jest jeszcze gotowe do wypłat")
  }

  const stripe = getStripeClient()
  const normalizedCurrency = currency.toLowerCase()
  const balance = await stripe.balance.retrieve({ stripeAccount: account.provider_account_id })
  const availableMinor = balance.available
    .filter((item) => item.currency === normalizedCurrency)
    .reduce((sum, item) => sum + item.amount, 0)

  if (availableMinor <= 0) throw new Error("Brak środków dostępnych do wypłaty")

  const { data: preparedRows, error: prepareError } = await supabase.rpc("marketplace_prepare_payout", {
    p_organization_id: organizationId,
    p_requested_by: requestedBy,
    p_currency: currency.toUpperCase(),
    p_available_minor: availableMinor,
  })

  if (prepareError || !preparedRows?.[0]) {
    throw new Error(prepareError?.message ?? "Nie udało się przygotować wypłaty")
  }

  const prepared = preparedRows[0] as {
    prepared_payout_id: string
    prepared_amount_minor: number | string
  }
  const payoutId = prepared.prepared_payout_id
  const amountMinor = Number(prepared.prepared_amount_minor)

  try {
    const payout = await stripe.payouts.create({
      amount: amountMinor,
      currency: normalizedCurrency,
      metadata: {
        enjoyhub_payout_id: payoutId,
        organization_id: organizationId,
      },
    }, {
      stripeAccount: account.provider_account_id,
      idempotencyKey: `enjoyhub-payout-${payoutId}`,
    })

    const { error: attachError } = await supabase.rpc("marketplace_attach_payout_provider", {
      p_payout_id: payoutId,
      p_provider_payout_id: payout.id,
    })
    if (attachError) throw new Error(attachError.message)

    return { payoutId, providerPayoutId: payout.id, amountMinor, currency: currency.toUpperCase() }
  } catch (payoutError) {
    const stripeErrorType = (payoutError as { type?: string }).type
    const definitelyRejected = stripeErrorType && ![
      "StripeAPIError",
      "StripeConnectionError",
      "StripeRateLimitError",
    ].includes(stripeErrorType)

    if (definitelyRejected) {
      await supabase.rpc("marketplace_fail_prepared_payout", {
        p_payout_id: payoutId,
        p_failure_code: stripeErrorType,
      })
    }

    throw payoutError
  }
}

export async function applyMarketplacePayoutEvent(
  providerPayoutId: string,
  status: "pending" | "paid" | "failed" | "cancelled",
  paidAt?: string | null,
  failureCode?: string | null,
) {
  if (!isSupabaseAdminConfigured) throw new Error("Supabase admin is not configured")
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("marketplace_apply_payout_event", {
    p_provider_payout_id: providerPayoutId,
    p_status: status,
    p_paid_at: paidAt ?? null,
    p_failure_code: failureCode ?? null,
  })
  if (error) throw new Error(error.message)
  return data
}
