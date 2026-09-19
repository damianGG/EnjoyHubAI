"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import {
  executePreparedMarketplaceRefund,
  type PreparedMarketplaceRefund,
} from "@/lib/marketplace/refunds"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isStripeConfigured } from "@/lib/stripe"

const refundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.string().trim().min(1).max(32),
  reason: z.string().trim().min(3).max(500),
})

const orderActionSchema = z.object({
  orderId: z.string().uuid(),
})

const rescheduleSchema = z.object({
  orderId: z.string().uuid(),
  targetSessionId: z.string().uuid(),
  reason: z.string().trim().max(500),
})

export async function markOrderPaidOnSite(formData: FormData) {
  const parsed = orderActionSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
  })
  if (!parsed.success) redirect("/host/sprzedaz")

  const { orderId } = parsed.data
  if (!isSupabaseConfigured) redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=konfiguracja`)

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/host/sprzedaz/zamowienie/${orderId}`)

  const { error } = await supabase.rpc("ticketing_mark_on_site_payment_paid", {
    p_order_id: orderId,
  })

  if (error) {
    console.error("Could not mark on-site payment as paid", {
      orderId,
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    const code = error.code === "42501" ? "uprawnienia" : "platnosc"
    redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=${code}`)
  }

  revalidatePath(`/host/sprzedaz/zamowienie/${orderId}`)
  revalidatePath("/host/sprzedaz")
  revalidatePath("/host")
  redirect(`/host/sprzedaz/zamowienie/${orderId}?status=oplacona`)
}

export async function rescheduleOrganizerBooking(formData: FormData) {
  const parsed = rescheduleSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    targetSessionId: String(formData.get("targetSessionId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  })

  if (!parsed.success) {
    const fallbackOrderId = String(formData.get("orderId") ?? "")
    redirect(`/host/sprzedaz/zamowienie/${fallbackOrderId}?blad=termin`)
  }

  const { orderId, targetSessionId, reason } = parsed.data
  if (!isSupabaseConfigured) redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=konfiguracja`)

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/host/sprzedaz/zamowienie/${orderId}`)

  const { error } = await supabase.rpc("ticketing_reschedule_organizer_booking", {
    p_order_id: orderId,
    p_to_session_id: targetSessionId,
    p_reason: reason,
  })

  if (error) {
    console.error("Organizer booking reschedule failed", {
      orderId,
      targetSessionId,
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    const message = error.message?.toLowerCase() ?? ""
    const code = error.code === "42501"
      ? "uprawnienia"
      : message.includes("capacity")
        ? "miejsca"
        : "termin"
    redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=${code}`)
  }

  revalidatePath(`/host/sprzedaz/zamowienie/${orderId}`)
  revalidatePath("/host/sprzedaz")
  revalidatePath("/host/kalendarz")
  revalidatePath("/host")
  revalidatePath("/checkout")
  redirect(`/host/sprzedaz/zamowienie/${orderId}?status=przeniesiona`)
}

export async function requestOrderRefund(formData: FormData) {
  const parsed = refundSchema.safeParse({
    orderId: formData.get("orderId"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  })

  if (!parsed.success) {
    const fallbackOrderId = String(formData.get("orderId") ?? "")
    redirect(`/host/sprzedaz/zamowienie/${fallbackOrderId}?blad=dane-zwrotu`)
  }

  const { orderId, amount, reason } = parsed.data
  const amountMinor = parseMoneyToMinor(amount)
  if (!amountMinor || amountMinor <= 0) {
    redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=dane-zwrotu`)
  }

  if (!isSupabaseConfigured || !isStripeConfigured) {
    redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=stripe`)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/host/sprzedaz/zamowienie/${orderId}`)

  const { data, error } = await supabase.rpc("marketplace_prepare_refund", {
    p_order_id: orderId,
    p_requested_by: user.id,
    p_amount_minor: amountMinor,
    p_reason: reason,
  })

  if (error || !data?.[0]) {
    console.error("Could not prepare marketplace refund", {
      orderId,
      userId: user.id,
      error: error?.message,
      code: error?.code,
    })
    const reasonCode = error?.code === "42501" ? "uprawnienia" : "zwrot"
    redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=${reasonCode}`)
  }

  try {
    await executePreparedMarketplaceRefund(data[0] as PreparedMarketplaceRefund)
  } catch (error) {
    console.error("Stripe marketplace refund failed", { orderId, userId: user.id, error })
    redirect(`/host/sprzedaz/zamowienie/${orderId}?blad=provider`)
  }

  revalidatePath(`/host/sprzedaz/zamowienie/${orderId}`)
  revalidatePath("/host/sprzedaz")
  revalidatePath("/host/rozliczenia")
  revalidatePath("/host/kalendarz")
  redirect(`/host/sprzedaz/zamowienie/${orderId}?status=zwrot`)
}

function parseMoneyToMinor(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".")
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ""] = normalized.split(".")
  const minor = Number(whole) * 100 + Number((fraction + "00").slice(0, 2))
  return Number.isSafeInteger(minor) ? minor : null
}
