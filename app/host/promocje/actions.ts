"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(3).max(32),
  kind: z.enum(["promotion", "voucher"]),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.string().trim().min(1).max(32),
  minimumSubtotal: z.string().trim().max(32),
  maxUses: z.string().trim().max(16),
  maxUsesPerCustomer: z.string().trim().max(16),
  validFrom: z.string().trim().max(10),
  validUntil: z.string().trim().max(10),
  scope: z.string().trim().max(100),
})

const toggleSchema = z.object({
  promotionId: z.string().uuid(),
  active: z.enum(["true", "false"]),
})

function parseMoney(value: string, fallback = 0) {
  const normalized = value.replace(/\s/g, "").replace(",", ".")
  if (!normalized) return fallback
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function parseOptionalInteger(value: string) {
  if (!value) return null
  if (!/^\d{1,9}$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : undefined
}

function dateBoundary(value: string, end = false) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`
}

export async function createPromotion(formData: FormData) {
  const parsed = createSchema.safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    discountType: String(formData.get("discountType") ?? ""),
    discountValue: String(formData.get("discountValue") ?? ""),
    minimumSubtotal: String(formData.get("minimumSubtotal") ?? ""),
    maxUses: String(formData.get("maxUses") ?? ""),
    maxUsesPerCustomer: String(formData.get("maxUsesPerCustomer") ?? ""),
    validFrom: String(formData.get("validFrom") ?? ""),
    validUntil: String(formData.get("validUntil") ?? ""),
    scope: String(formData.get("scope") ?? ""),
  })

  if (!parsed.success) redirect("/host/promocje?blad=dane")
  const input = parsed.data

  const discountValue = parseMoney(input.discountValue)
  const minimumSubtotal = parseMoney(input.minimumSubtotal, 0)
  const maxUses = parseOptionalInteger(input.maxUses)
  const maxUsesPerCustomer = parseOptionalInteger(input.maxUsesPerCustomer)
  const validFrom = dateBoundary(input.validFrom)
  const validUntil = dateBoundary(input.validUntil, true)

  if (
    discountValue === null ||
    minimumSubtotal === null ||
    maxUses === undefined ||
    maxUsesPerCustomer === undefined ||
    validFrom === undefined ||
    validUntil === undefined
  ) {
    redirect("/host/promocje?blad=dane")
  }

  let productId: string | null = null
  let attractionId: string | null = null
  if (input.scope && input.scope !== "organization") {
    const [scopeType, scopeId] = input.scope.split(":")
    if (!z.string().uuid().safeParse(scopeId).success) redirect("/host/promocje?blad=zakres")
    if (scopeType === "product") productId = scopeId
    else if (scopeType === "attraction") attractionId = scopeId
    else redirect("/host/promocje?blad=zakres")
  }

  if (!isSupabaseConfigured) redirect("/host/promocje?blad=konfiguracja")
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/promocje")

  const { data, error } = await supabase.rpc("ticketing_create_promotion", {
    p_organization_id: input.organizationId,
    p_name: input.name,
    p_code: input.code,
    p_kind: input.kind,
    p_discount_type: input.discountType,
    p_discount_value: discountValue,
    p_currency: input.discountType === "fixed" ? "PLN" : null,
    p_minimum_subtotal: minimumSubtotal,
    p_max_uses: maxUses,
    p_max_uses_per_customer: maxUsesPerCustomer,
    p_valid_from: validFrom,
    p_valid_until: validUntil,
    p_product_id: productId,
    p_venue_id: null,
    p_attraction_id: attractionId,
  })

  if (error || !data) {
    console.error("Promotion creation failed", {
      userId: user.id,
      code: error?.code,
      message: error?.message,
    })
    const code = error?.code === "42501"
      ? "uprawnienia"
      : error?.code === "23505"
        ? "kod"
        : "zapis"
    redirect("/host/promocje?blad=" + code)
  }

  revalidatePath("/host/promocje")
  revalidatePath("/checkout")
  redirect("/host/promocje?ok=utworzona")
}

export async function setPromotionActive(formData: FormData) {
  const parsed = toggleSchema.safeParse({
    promotionId: String(formData.get("promotionId") ?? ""),
    active: String(formData.get("active") ?? ""),
  })
  if (!parsed.success) redirect("/host/promocje?blad=dane")

  if (!isSupabaseConfigured) redirect("/host/promocje?blad=konfiguracja")
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/promocje")

  const { error } = await supabase.rpc("ticketing_set_promotion_active", {
    p_promotion_id: parsed.data.promotionId,
    p_active: parsed.data.active === "true",
  })

  if (error) {
    console.error("Promotion toggle failed", {
      userId: user.id,
      promotionId: parsed.data.promotionId,
      code: error.code,
      message: error.message,
    })
    redirect("/host/promocje?blad=" + (error.code === "42501" ? "uprawnienia" : "zapis"))
  }

  revalidatePath("/host/promocje")
  revalidatePath("/checkout")
  redirect("/host/promocje?ok=status")
}
