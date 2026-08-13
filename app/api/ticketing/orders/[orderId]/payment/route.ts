import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe"
import {
  checkoutCookieMaxAgeSeconds,
  checkoutCookieName,
  isTicketingPaymentsEnabled,
  paymentHoldMinutes,
  stripeCheckoutMinutes,
} from "@/lib/ticketing/config"
import { getCheckoutOrderSummary } from "@/lib/ticketing/queries"
import {
  checkoutCookieMatches,
  isSameOriginRequest,
  parseCheckoutCookie,
} from "@/lib/ticketing/security"

export const runtime = "nodejs"

interface PreparedPayment {
  payment_attempt_id: string
  payment_attempt_token: string
  current_provider_checkout_id: string | null
  current_attempt_status: "creating" | "open"
  payment_order_number: number
  payment_amount_minor: number | string
  payment_currency: string
  payment_customer_email: string
  payment_hold_expires_at: string
}

function paymentError(message: string, status = 409) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isTicketingPaymentsEnabled) {
    return paymentError("Płatności są jeszcze wyłączone.", 404)
  }

  if (!isSupabaseAdminConfigured || !isStripeConfigured) {
    return paymentError("Płatności nie mają jeszcze pełnej konfiguracji.", 503)
  }

  if (!isSameOriginRequest(request)) {
    return paymentError("Niedozwolone źródło żądania.", 403)
  }

  const { orderId } = await params
  if (!z.string().uuid().safeParse(orderId).success) {
    return paymentError("Nieprawidłowe zamówienie.", 400)
  }

  const cookieStore = await cookies()
  const checkoutCookie = parseCheckoutCookie(cookieStore.get(checkoutCookieName)?.value)
  if (!checkoutCookieMatches(checkoutCookie, orderId)) {
    return paymentError("Brak dostępu do zamówienia.", 403)
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("ticketing_prepare_payment_checkout", {
    p_order_id: orderId,
    p_hold_token: checkoutCookie!.holdToken,
    p_provider: "stripe",
    p_hold_minutes: paymentHoldMinutes,
  })

  if (error || !data?.[0]) {
    console.error("Ticketing payment preparation error", error)
    return paymentError(
      error?.message.includes("starts too soon")
        ? "Termin rozpoczyna się zbyt szybko, aby otworzyć płatność online."
        : "Nie można już rozpocząć płatności dla tego zamówienia.",
    )
  }

  const prepared = data[0] as PreparedPayment
  const stripe = getStripeClient()

  if (prepared.current_provider_checkout_id) {
    const existingSession = await stripe.checkout.sessions.retrieve(
      prepared.current_provider_checkout_id,
    )

    if (existingSession.status === "open" && existingSession.url) {
      return paymentResponse(existingSession.url, orderId, checkoutCookie!.holdToken)
    }

    if (existingSession.payment_status === "paid") {
      return paymentResponse(
        `/checkout/zamowienie/${orderId}?platnosc=powrot`,
        orderId,
        checkoutCookie!.holdToken,
      )
    }

    return paymentError("Ta sesja płatności wygasła. Wybierz bilety ponownie.")
  }

  const order = await getCheckoutOrderSummary(orderId, checkoutCookie!.holdToken)
  if (!order || order.status !== "awaiting_payment") {
    return paymentError("Zamówienie nie oczekuje już na płatność.")
  }

  const lineItems = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: prepared.payment_currency.toLowerCase(),
      unit_amount: Math.round(item.unitPriceAmount * 100),
      product_data: {
        name: `${item.productName} — ${item.ticketTypeName}`.slice(0, 127),
      },
    },
  }))
  const calculatedAmount = lineItems.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0,
  )

  if (calculatedAmount !== Number(prepared.payment_amount_minor)) {
    console.error("Ticketing payment amount mismatch before Stripe", {
      orderId,
      calculatedAmount,
      expectedAmount: prepared.payment_amount_minor,
    })
    return paymentError("Nie udało się potwierdzić kwoty zamówienia.", 500)
  }

  const checkoutExpiresAt = Math.floor(Date.now() / 1000) + stripeCheckoutMinutes * 60
  if (checkoutExpiresAt * 1000 >= new Date(prepared.payment_hold_expires_at).getTime()) {
    return paymentError("Blokada miejsc jest zbyt krótka do rozpoczęcia płatności.")
  }

  const returnUrl = new URL(`/checkout/zamowienie/${orderId}`, request.url)
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "pl",
    customer_email: prepared.payment_customer_email,
    client_reference_id: orderId,
    line_items: lineItems,
    expires_at: checkoutExpiresAt,
    success_url: `${returnUrl.toString()}?platnosc=powrot`,
    cancel_url: `${returnUrl.toString()}?platnosc=anulowana`,
    metadata: {
      order_id: orderId,
      payment_attempt_id: prepared.payment_attempt_id,
      checkout_version: "1d",
    },
    payment_intent_data: {
      metadata: {
        order_id: orderId,
        payment_attempt_id: prepared.payment_attempt_id,
      },
    },
  }, {
    idempotencyKey: `enjoyhub-payment-${prepared.payment_attempt_id}`,
  })

  if (!session.url) {
    return paymentError("Operator płatności nie zwrócił adresu płatności.", 502)
  }

  const { error: attachError } = await supabase.rpc(
    "ticketing_attach_payment_checkout",
    {
      p_payment_attempt_id: prepared.payment_attempt_id,
      p_payment_attempt_token: prepared.payment_attempt_token,
      p_provider_checkout_id: session.id,
      p_checkout_expires_at: new Date(checkoutExpiresAt * 1000).toISOString(),
    },
  )

  if (attachError) {
    console.error("Ticketing Stripe session attach error", attachError)
    return paymentError("Nie udało się bezpiecznie połączyć płatności z zamówieniem.", 500)
  }

  return paymentResponse(session.url, orderId, checkoutCookie!.holdToken)
}

function paymentResponse(url: string, orderId: string, holdToken: string) {
  const response = NextResponse.json({ url })
  response.cookies.set({
    name: checkoutCookieName,
    value: `${orderId}.${holdToken}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: checkoutCookieMaxAgeSeconds,
  })
  return response
}
