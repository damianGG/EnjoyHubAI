"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

const exceptionSchema = z.object({
  scheduleId: z.string().uuid(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["closed", "override"]),
  localStartTime: z.string().optional(),
  localEndTime: z.string().optional(),
  capacity: z.string().optional(),
  reason: z.string().trim().max(240).optional(),
})

function errorCode(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  if (message.includes("weekday of its recurring schedule")) return "dzien"
  if (error?.code === "P0001") return "rezerwacje"
  if (error?.code === "42501") return "uprawnienia"
  if (error?.code === "22023") return "dane"
  return "zapis"
}

export async function setAvailabilityException(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/host/sprzedaz/dostepnosc?blad=konfiguracja")

  const parsed = exceptionSchema.safeParse({
    scheduleId: String(formData.get("scheduleId") ?? ""),
    localDate: String(formData.get("localDate") ?? ""),
    mode: String(formData.get("mode") ?? ""),
    localStartTime: String(formData.get("localStartTime") ?? ""),
    localEndTime: String(formData.get("localEndTime") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  })

  if (!parsed.success) redirect("/host/sprzedaz/dostepnosc?blad=dane")

  const input = parsed.data
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz/dostepnosc")

  const start = input.mode === "override" && input.localStartTime ? input.localStartTime : null
  const end = input.mode === "override" && input.localEndTime ? input.localEndTime : null
  const capacity = input.mode === "override" && input.capacity ? Number(input.capacity) : null

  const { error } = await supabase.rpc("ticketing_set_schedule_exception", {
    p_schedule_id: input.scheduleId,
    p_local_date: input.localDate,
    p_mode: input.mode,
    p_local_start_time: start,
    p_local_end_time: end,
    p_capacity: Number.isFinite(capacity) ? capacity : null,
    p_reason: input.reason || null,
  })

  if (error) {
    console.error("Availability exception update failed", { code: error.code, message: error.message })
    redirect(`/host/sprzedaz/dostepnosc?blad=${errorCode(error)}`)
  }

  revalidatePath("/host/sprzedaz/dostepnosc")
  revalidatePath("/checkout")
  redirect("/host/sprzedaz/dostepnosc?ok=wyjatek")
}

export async function clearAvailabilityException(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/host/sprzedaz/dostepnosc?blad=konfiguracja")

  const parsed = z.object({
    scheduleId: z.string().uuid(),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).safeParse({
    scheduleId: String(formData.get("scheduleId") ?? ""),
    localDate: String(formData.get("localDate") ?? ""),
  })

  if (!parsed.success) redirect("/host/sprzedaz/dostepnosc?blad=dane")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz/dostepnosc")

  const { error } = await supabase.rpc("ticketing_clear_schedule_exception", {
    p_schedule_id: parsed.data.scheduleId,
    p_local_date: parsed.data.localDate,
  })

  if (error) {
    console.error("Availability exception clear failed", { code: error.code, message: error.message })
    redirect(`/host/sprzedaz/dostepnosc?blad=${errorCode(error)}`)
  }

  revalidatePath("/host/sprzedaz/dostepnosc")
  revalidatePath("/checkout")
  redirect("/host/sprzedaz/dostepnosc?ok=przywrocono")
}
