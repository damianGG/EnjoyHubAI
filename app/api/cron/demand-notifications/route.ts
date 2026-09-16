import { NextResponse } from "next/server"

import { sendDemandAvailabilityEmail } from "@/lib/email/demand-availability"
import { isStripeConnectEnabled } from "@/lib/stripe-connect"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isTicketingPaymentsEnabled } from "@/lib/ticketing/config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type DemandNotificationDelivery = {
  notification_id: string
  demand_request_id: string
  recipient_email: string
  attraction_id: string
  attraction_title: string
  desired_date: string
  party_size: number
  organization_id: string
}

type PaymentAccountRow = {
  organization_id: string
  provider_account_id: string | null
  charges_enabled: boolean
  card_payments_enabled: boolean
  transfers_enabled: boolean
  payouts_enabled: boolean
  payout_schedule_manual: boolean
}

function connectAccountReady(account?: PaymentAccountRow) {
  return Boolean(
    account?.provider_account_id
    && account.charges_enabled
    && account.card_payments_enabled
    && account.transfers_enabled
    && account.payouts_enabled
    && account.payout_schedule_manual,
  )
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  if (!isTicketingPaymentsEnabled) {
    return NextResponse.json({ ok: true, skipped: "payments_disabled", prepared: 0, queued: 0, sent: 0 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("marketplace_prepare_demand_notifications", {
    p_limit: 100,
  })

  if (error) {
    console.error("Demand notification preparation failed", {
      code: error.code,
      message: error.message,
    })
    return NextResponse.json({ error: "Demand notification preparation failed" }, { status: 500 })
  }

  const deliveries = (data ?? []) as DemandNotificationDelivery[]
  const paymentAccounts = new Map<string, PaymentAccountRow>()

  if (isStripeConnectEnabled && deliveries.length > 0) {
    const organizationIds = [...new Set(deliveries.map((item) => item.organization_id))]
    const { data: accountData, error: accountError } = await supabase
      .from("organization_payment_accounts")
      .select("organization_id, provider_account_id, charges_enabled, card_payments_enabled, transfers_enabled, payouts_enabled, payout_schedule_manual")
      .in("organization_id", organizationIds)

    if (accountError) {
      console.error("Demand notification Connect readiness lookup failed", {
        message: accountError.message,
      })
      return NextResponse.json({ error: "Payment readiness lookup failed" }, { status: 503 })
    }

    for (const row of (accountData ?? []) as PaymentAccountRow[]) {
      paymentAccounts.set(row.organization_id, row)
    }
  }

  let queued = 0
  let sent = 0
  let failed = 0
  let deferred = 0

  for (const delivery of deliveries) {
    if (isStripeConnectEnabled && !connectAccountReady(paymentAccounts.get(delivery.organization_id))) {
      deferred += 1
      const { error: deferError } = await supabase.rpc("marketplace_defer_demand_notification", {
        p_notification_id: delivery.notification_id,
        p_retry_minutes: 360,
        p_reason: "Stripe Connect account is not ready for customer checkout",
      })
      if (deferError) {
        failed += 1
        console.error("Demand notification defer failed", {
          notificationId: delivery.notification_id,
          message: deferError.message,
        })
      }
      continue
    }

    const result = await sendDemandAvailabilityEmail({
      notificationId: delivery.notification_id,
      demandRequestId: delivery.demand_request_id,
      recipientEmail: delivery.recipient_email,
      attractionId: delivery.attraction_id,
      attractionTitle: delivery.attraction_title,
      desiredDate: delivery.desired_date,
      partySize: Number(delivery.party_size),
    })

    if (result.sent) {
      const { error: completionError } = await supabase.rpc("marketplace_complete_demand_notification", {
        p_notification_id: delivery.notification_id,
        p_success: true,
        p_provider_message_id: result.providerMessageId ?? result.id ?? null,
        p_error: null,
      })
      if (completionError) {
        failed += 1
        console.error("Demand notification sent-state repair failed", {
          notificationId: delivery.notification_id,
          message: completionError.message,
        })
      } else {
        sent += 1
      }
      continue
    }

    if (result.queued && result.status !== "failed") {
      queued += 1
      continue
    }

    const { error: completionError } = await supabase.rpc("marketplace_complete_demand_notification", {
      p_notification_id: delivery.notification_id,
      p_success: false,
      p_provider_message_id: null,
      p_error: result.error ?? result.reason ?? "Could not queue demand notification email",
    })

    if (completionError) {
      console.error("Demand notification failure-state update failed", {
        notificationId: delivery.notification_id,
        message: completionError.message,
      })
    }

    failed += 1
    console.error("Demand availability email could not be queued", {
      notificationId: delivery.notification_id,
      demandRequestId: delivery.demand_request_id,
      outboxId: result.outboxId,
      status: result.status,
      reason: result.reason,
      error: result.error,
    })
  }

  return NextResponse.json({
    ok: failed === 0,
    prepared: deliveries.length,
    queued,
    sent,
    deferred,
    failed,
    finishedAt: new Date().toISOString(),
  }, { status: failed > 0 && queued === 0 && sent === 0 ? 503 : 200 })
}
