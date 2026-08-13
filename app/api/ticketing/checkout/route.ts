import { NextResponse } from "next/server"
import { z } from "zod"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  checkoutCookieName,
  checkoutHoldMinutes,
  isTicketingCheckoutEnabled,
} from "@/lib/ticketing/config"
import {
  createCheckoutFingerprint,
  getRequestIp,
  isSameOriginRequest,
} from "@/lib/ticketing/security"

export const runtime = "nodejs"

const checkoutSchema = z.object({
  checkoutKey: z.string().uuid(),
  sessionId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(160),
  customerEmail: z.string().trim().email().max(254),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  termsAccepted: z.literal(true),
  items: z.array(z.object({
    ticketTypeId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(20),
})

interface RateLimitResult {
  allowed: boolean
  retry_after_seconds: number
}

async function consumeRateLimit(
  keyHash: string,
  limit: number,
  windowSeconds: number,
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "ticketing_consume_checkout_rate_limit",
    {
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    },
  )

  if (error || !data?.[0]) {
    throw new Error("Nie udało się sprawdzić limitu checkoutu")
  }

  return data[0] as RateLimitResult
}

function checkoutErrorResponse(message: string) {
  if (message.includes("Insufficient capacity")) {
    return NextResponse.json(
      { error: "Wybrane bilety nie są już dostępne w tej liczbie." },
      { status: 409 },
    )
  }

  if (
    message.includes("Sales are closed") ||
    message.includes("not available for EnjoyHub checkout")
  ) {
    return NextResponse.json(
      { error: "Sprzedaż dla tego terminu jest już zamknięta." },
      { status: 409 },
    )
  }

  if (
    message.includes("invalid quantity") ||
    message.includes("participant count") ||
    message.includes("valid customer") ||
    message.includes("Checkout contains")
  ) {
    return NextResponse.json(
      { error: "Sprawdź wybrane bilety i dane kupującego." },
      { status: 400 },
    )
  }

  return NextResponse.json(
    { error: "Nie udało się rozpocząć zamówienia. Spróbuj ponownie." },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  if (!isTicketingCheckoutEnabled) {
    return NextResponse.json({ error: "Checkout jest wyłączony." }, { status: 404 })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: "Checkout nie ma jeszcze konfiguracji serwerowej." },
      { status: 503 },
    )
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane żądania." }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Sprawdź wybrane bilety i dane kupującego." },
      { status: 400 },
    )
  }

  const input = parsed.data

  try {
    const ip = getRequestIp(request)
    const normalizedEmail = input.customerEmail.toLowerCase()
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(
        createCheckoutFingerprint(`ip:${ip}:session:${input.sessionId}`),
        8,
        60,
      ),
      consumeRateLimit(
        createCheckoutFingerprint(`email:${normalizedEmail}:session:${input.sessionId}`),
        5,
        300,
      ),
    ])

    const blockedLimit = [ipLimit, emailLimit].find((limit) => !limit.allowed)
    if (blockedLimit) {
      return NextResponse.json(
        { error: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie." },
        {
          status: 429,
          headers: {
            "Retry-After": String(blockedLimit.retry_after_seconds),
          },
        },
      )
    }

    const userClient = createClient()
    const { data: { user } } = await userClient.auth.getUser()
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("ticketing_create_order_hold", {
      p_checkout_key: input.checkoutKey,
      p_session_id: input.sessionId,
      p_customer_name: input.customerName,
      p_customer_email: normalizedEmail,
      p_items: input.items.map((item) => ({
        ticket_type_id: item.ticketTypeId,
        quantity: item.quantity,
      })),
      p_customer_user_id: user?.id ?? null,
      p_customer_phone: input.customerPhone || null,
      p_source: "enjoyhub_marketplace",
      p_hold_minutes: checkoutHoldMinutes,
      p_terms_accepted: input.termsAccepted,
      p_metadata: { checkout_version: "1c" },
    })

    if (error || !data?.[0]) {
      return checkoutErrorResponse(error?.message ?? "Unknown checkout error")
    }

    const order = data[0] as {
      created_order_id: string
      created_order_number: number
      created_hold_token: string
      hold_expires_at: string
      created_total_amount: number | string
      created_currency: string
      available_capacity_units: number
    }

    const response = NextResponse.json({
      orderId: order.created_order_id,
      orderNumber: order.created_order_number,
      expiresAt: order.hold_expires_at,
      totalAmount: Number(order.created_total_amount),
      currency: order.created_currency,
      availableCapacity: order.available_capacity_units,
    }, { status: 201 })

    response.cookies.set({
      name: checkoutCookieName,
      value: `${order.created_order_id}.${order.created_hold_token}`,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: checkoutHoldMinutes * 60 + 5 * 60,
    })

    return response
  } catch (error) {
    console.error("Ticketing checkout error", error)
    return NextResponse.json(
      { error: "Checkout nie jest jeszcze poprawnie skonfigurowany." },
      { status: 503 },
    )
  }
}
