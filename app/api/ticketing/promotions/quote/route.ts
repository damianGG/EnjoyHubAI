import { NextResponse } from "next/server"
import { z } from "zod"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  createCheckoutFingerprint,
  getRequestIp,
  isSameOriginRequest,
} from "@/lib/ticketing/security"

export const runtime = "nodejs"

const schema = z.object({
  sessionId: z.string().uuid(),
  code: z.string().trim().min(3).max(32),
  customerEmail: z.string().trim().email().max(254).optional().nullable(),
  items: z.array(z.object({
    ticketTypeId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(20),
})

interface RateLimitResult {
  allowed: boolean
  retry_after_seconds: number
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Kody rabatowe są chwilowo niedostępne." }, { status: 503 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 })
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Sprawdź kod i wybrane bilety." }, { status: 400 })
  }

  const input = parsed.data
  const supabase = createAdminClient()
  const ip = getRequestIp(request)
  const { data: limitData, error: limitError } = await supabase.rpc(
    "ticketing_consume_checkout_rate_limit",
    {
      p_key_hash: createCheckoutFingerprint(`promo:${ip}:session:${input.sessionId}`),
      p_limit: 12,
      p_window_seconds: 60,
    },
  )

  const limit = limitData?.[0] as RateLimitResult | undefined
  if (limitError || !limit) {
    return NextResponse.json({ error: "Nie udało się sprawdzić kodu." }, { status: 503 })
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Za dużo prób sprawdzania kodu. Spróbuj ponownie za chwilę." },
      { status: 429, headers: { "Retry-After": String(limit.retry_after_seconds) } },
    )
  }

  const { data, error } = await supabase.rpc("ticketing_quote_promotion", {
    p_session_id: input.sessionId,
    p_code: input.code,
    p_items: input.items.map((item) => ({
      ticket_type_id: item.ticketTypeId,
      quantity: item.quantity,
    })),
    p_customer_email: input.customerEmail || null,
    p_customer_user_id: null,
  })

  if (error || !data) {
    const message = error?.message?.toLowerCase() ?? ""
    const userMessage = message.includes("minimum subtotal")
      ? "Ten kod obowiązuje od wyższej wartości zamówienia."
      : message.includes("customer usage limit")
        ? "Ten kod został już wykorzystany maksymalną liczbę razy przez tego klienta."
        : message.includes("usage limit")
          ? "Limit użyć tego kodu został już wykorzystany."
          : "Kod jest nieprawidłowy, wygasł albo nie obowiązuje dla tej oferty."

    return NextResponse.json({ error: userMessage }, { status: 409 })
  }

  return NextResponse.json(data)
}
