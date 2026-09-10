"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

const schema = z.object({
  organizationId: z.string().uuid(),
  legalName: z.string().trim().min(2).max(240),
  taxId: z.string().transform((value) => value.replace(/[^0-9]/g, "")).pipe(z.string().length(10)),
  billingEmail: z.string().trim().email().max(254),
})

export async function submitOrganizerVerification(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/host/weryfikacja?blad=konfiguracja")

  const parsed = schema.safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    billingEmail: String(formData.get("billingEmail") ?? ""),
  })

  if (!parsed.success) redirect("/host/weryfikacja?blad=dane")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/weryfikacja")

  const { error } = await supabase.rpc("organizer_submit_verification", {
    p_organization_id: parsed.data.organizationId,
    p_legal_name: parsed.data.legalName,
    p_tax_id: parsed.data.taxId,
    p_billing_email: parsed.data.billingEmail,
  })

  if (error) {
    console.error("Organizer verification submission failed", { code: error.code, message: error.message })
    redirect(error.code === "42501" ? "/host/weryfikacja?blad=uprawnienia" : "/host/weryfikacja?blad=zapis")
  }

  revalidatePath("/host")
  revalidatePath("/host/weryfikacja")
  redirect("/host/weryfikacja?status=wyslane")
}
