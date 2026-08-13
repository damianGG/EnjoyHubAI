import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  checkoutCookieName,
  isTicketingCheckoutEnabled,
  isTicketingPaymentsEnabled,
} from "@/lib/ticketing/config"
import {
  checkoutCookieMatches,
  isSameOriginRequest,
  parseCheckoutCookie,
} from "@/lib/ticketing/security"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isTicketingCheckoutEnabled || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Checkout jest niedostępny." }, { status: 404 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 })
  }

  const { orderId } = await params
  if (!z.string().uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Nieprawidłowe zamówienie." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const checkoutCookie = parseCheckoutCookie(cookieStore.get(checkoutCookieName)?.value)
  if (!checkoutCookieMatches(checkoutCookie, orderId)) {
    return NextResponse.json({ error: "Brak dostępu do zamówienia." }, { status: 403 })
  }

  const supabase = createAdminClient()

  if (isTicketingPaymentsEnabled) {
    const { data: orderState, error: orderStateError } = await supabase
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .single()

    if (orderStateError) {
      return NextResponse.json(
        { error: "Nie udało się sprawdzić stanu płatności." },
        { status: 500 },
      )
    }

    if (orderState.payment_status === "pending") {
      return NextResponse.json(
        { error: "Aktywna sesja płatności zwolni miejsca automatycznie po wygaśnięciu." },
        { status: 409 },
      )
    }
  }

  const { error } = await supabase.rpc("ticketing_release_order_hold", {
    p_order_id: orderId,
    p_hold_token: checkoutCookie!.holdToken,
  })

  if (error) {
    console.error("Ticketing hold release error", error)
    return NextResponse.json(
      { error: "Nie udało się zwolnić blokady miejsc." },
      { status: 409 },
    )
  }

  const response = NextResponse.json({ released: true })
  response.cookies.delete(checkoutCookieName)
  return response
}
