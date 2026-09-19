"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

const bookingSchema = z.object({
  sessionId: z.string().uuid(),
  bookingSource: z.enum(["manual", "walk_in"]),
  customerName: z.string().trim().max(160),
  customerEmail: z.string().trim().max(254),
  customerPhone: z.string().trim().max(40),
  paymentMode: z.enum(["on_site_unpaid", "on_site_paid"]),
  note: z.string().trim().max(1000),
})

export async function createOrganizerBooking(formData: FormData) {
  const values = {
    sessionId: String(formData.get("sessionId") ?? ""),
    bookingSource: String(formData.get("bookingSource") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    paymentMode: String(formData.get("paymentMode") ?? ""),
    note: String(formData.get("note") ?? ""),
  }
  const parsed = bookingSchema.safeParse(values)
  if (!parsed.success) redirect("/host/rezerwacje/nowa?blad=dane")

  const input = parsed.data
  if (input.customerEmail && !z.string().email().safeParse(input.customerEmail).success) {
    redirect("/host/rezerwacje/nowa?blad=email")
  }

  const items: Array<{ ticket_type_id: string; quantity: number }> = []
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("ticket-")) continue
    const ticketTypeId = key.slice(7)
    const quantity = Number(rawValue)
    if (z.string().uuid().safeParse(ticketTypeId).success && Number.isInteger(quantity) && quantity > 0 && quantity <= 100) {
      items.push({ ticket_type_id: ticketTypeId, quantity })
    }
  }
  if (!items.length) redirect("/host/rezerwacje/nowa?blad=bilety")
  if (!isSupabaseConfigured) redirect("/host/rezerwacje/nowa?blad=konfiguracja")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/rezerwacje/nowa")

  const { data, error } = await supabase.rpc("ticketing_create_organizer_booking", {
    p_session_id: input.sessionId,
    p_customer_name: input.customerName,
    p_customer_email: input.customerEmail,
    p_customer_phone: input.customerPhone,
    p_items: items,
    p_booking_source: input.bookingSource,
    p_payment_method: "on_site",
    p_mark_paid: input.paymentMode === "on_site_paid",
    p_note: input.note,
  })

  if (error || !data) {
    console.error("Organizer booking creation failed", {
      userId: user.id,
      sessionId: input.sessionId,
      code: error?.code,
      message: error?.message,
    })
    const message = error?.message?.toLowerCase() ?? ""
    const code = error?.code === "42501"
      ? "uprawnienia"
      : message.includes("capacity")
        ? "miejsca"
        : message.includes("email")
          ? "email"
          : "zapis"
    redirect("/host/rezerwacje/nowa?blad=" + code)
  }

  const result = data as unknown as { orderId?: string }
  if (!result.orderId || !z.string().uuid().safeParse(result.orderId).success) {
    redirect("/host/rezerwacje/nowa?blad=zapis")
  }

  revalidatePath("/host")
  revalidatePath("/host/kalendarz")
  revalidatePath("/host/sprzedaz")
  revalidatePath("/checkout")
  redirect("/host/sprzedaz/zamowienie/" + result.orderId + "?status=utworzona")
}
