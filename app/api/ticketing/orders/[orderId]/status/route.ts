import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { checkoutCookieName, isTicketingPaymentsEnabled } from "@/lib/ticketing/config"
import { getCheckoutOrderSummary } from "@/lib/ticketing/queries"
import {
  checkoutCookieMatches,
  parseCheckoutCookie,
} from "@/lib/ticketing/security"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isTicketingPaymentsEnabled) {
    return NextResponse.json({ error: "Płatności są wyłączone." }, { status: 404 })
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

  const order = await getCheckoutOrderSummary(orderId, checkoutCookie!.holdToken)
  if (!order) {
    return NextResponse.json({ error: "Nie znaleziono zamówienia." }, { status: 404 })
  }

  return NextResponse.json({
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    tickets: order.tickets.length,
  }, {
    headers: { "Cache-Control": "no-store" },
  })
}
