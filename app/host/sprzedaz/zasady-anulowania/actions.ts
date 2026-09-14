"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

const schema = z.object({
  productId: z.string().uuid(),
  policyCode: z.enum(["flexible_24h", "non_refundable", "custom"]),
  deadlineHours: z.coerce.number().int().min(0).max(720),
  customText: z.string().trim().max(2000),
}).superRefine((value, context) => {
  if (value.policyCode === "custom" && value.customText.length < 20) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customText"],
      message: "Własne zasady muszą mieć co najmniej 20 znaków.",
    })
  }
})

export async function updateCancellationPolicy(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/host/sprzedaz/zasady-anulowania?blad=konfiguracja")

  const parsed = schema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    policyCode: String(formData.get("policyCode") ?? ""),
    deadlineHours: String(formData.get("deadlineHours") ?? "24"),
    customText: String(formData.get("customText") ?? ""),
  })

  if (!parsed.success) redirect("/host/sprzedaz/zasady-anulowania?blad=dane")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz/zasady-anulowania")

  const { error } = await supabase.rpc("ticketing_update_cancellation_policy", {
    p_product_id: parsed.data.productId,
    p_policy_code: parsed.data.policyCode,
    p_deadline_hours: parsed.data.policyCode === "non_refundable" ? 0 : parsed.data.deadlineHours,
    p_custom_text: parsed.data.policyCode === "custom" ? parsed.data.customText : null,
  })

  if (error) {
    console.error("Cancellation policy update failed", { code: error.code, message: error.message })
    redirect(error.code === "42501" ? "/host/sprzedaz/zasady-anulowania?blad=uprawnienia" : "/host/sprzedaz/zasady-anulowania?blad=zapis")
  }

  revalidatePath("/host/sprzedaz")
  revalidatePath("/host/sprzedaz/zasady-anulowania")
  revalidatePath("/checkout")
  redirect(`/host/sprzedaz/zasady-anulowania?zapisano=${parsed.data.productId}`)
}
