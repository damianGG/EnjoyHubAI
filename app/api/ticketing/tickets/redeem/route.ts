import { NextResponse } from "next/server"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isTicketingPaymentsEnabled } from "@/lib/ticketing/config"
import { isSameOriginRequest } from "@/lib/ticketing/security"

export const runtime = "nodejs"

const redeemSchema = z.object({
  ticketCode: z.string().uuid(),
})

export async function POST(request: Request) {
  if (!isSupabaseConfigured || !isTicketingPaymentsEnabled) {
    return NextResponse.json({ error: "Kontrola biletów jest wyłączona." }, { status: 404 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane żądania." }, { status: 400 })
  }

  const parsed = redeemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowy kod biletu." }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Zaloguj się jako pracownik obiektu." }, { status: 401 })
  }

  const { data, error } = await supabase.rpc("ticketing_redeem_ticket", {
    p_ticket_code: parsed.data.ticketCode,
  })

  if (error || !data?.[0]) {
    console.error("Ticket redemption error", error)
    const status = error?.code === "42501"
      ? 403
      : error?.code === "P0002"
        ? 404
        : 409
    return NextResponse.json({
      error: status === 403
        ? "Nie masz uprawnień do kontroli tego biletu."
        : status === 404
          ? "Nie znaleziono biletu."
          : "Tego biletu nie można wykorzystać.",
    }, { status })
  }

  const ticket = data[0] as {
    redeemed_ticket_code: string
    current_ticket_status: string
    ticket_used_at: string
    ticket_was_already_used: boolean
    redeemed_product_name: string
    redeemed_ticket_type_name: string
    redeemed_session_starts_at: string
    redeemed_venue_name: string
  }

  return NextResponse.json({
    ticketCode: ticket.redeemed_ticket_code,
    status: ticket.current_ticket_status,
    usedAt: ticket.ticket_used_at,
    alreadyUsed: ticket.ticket_was_already_used,
    productName: ticket.redeemed_product_name,
    ticketTypeName: ticket.redeemed_ticket_type_name,
    sessionStartsAt: ticket.redeemed_session_starts_at,
    venueName: ticket.redeemed_venue_name,
  })
}
