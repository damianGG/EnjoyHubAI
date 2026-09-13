"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requirePlatformStaff } from "@/lib/platform-admin/access"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on"
}

export async function createSupplyLeadAction(formData: FormData) {
  const { supabase } = await requirePlatformStaff(supplyRoles, "/admin/supply")

  const payload = {
    name: text(formData, "name"),
    source_kind: text(formData, "source_kind") || "manual",
    source_url: text(formData, "source_url"),
    website_url: text(formData, "website_url"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    city: text(formData, "city"),
    region: text(formData, "region"),
    booking_method: text(formData, "booking_method") || "unknown",
    admin_notes: text(formData, "admin_notes"),
  }

  const { data, error } = await supabase.rpc("platform_supply_create_lead", { p_data: payload })
  if (error || !data) redirect("/admin/supply?blad=create")

  revalidatePath("/admin/supply")
  redirect(`/admin/supply/${data}`)
}

export async function updateSupplyLeadAction(leadId: string, formData: FormData) {
  const { supabase } = await requirePlatformStaff(supplyRoles, `/admin/supply/${leadId}`)

  const payload = {
    name: text(formData, "name"),
    source_kind: text(formData, "source_kind") || "manual",
    source_url: text(formData, "source_url"),
    website_url: text(formData, "website_url"),
    booking_url: text(formData, "booking_url"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    address_line_1: text(formData, "address_line_1"),
    city: text(formData, "city"),
    region: text(formData, "region"),
    postal_code: text(formData, "postal_code"),
    country_code: text(formData, "country_code") || "PL",
    latitude: text(formData, "latitude"),
    longitude: text(formData, "longitude"),
    category_id: text(formData, "category_id"),
    subcategory_id: text(formData, "subcategory_id"),
    short_description: text(formData, "short_description"),
    public_description: text(formData, "public_description"),
    price_from: text(formData, "price_from"),
    currency: text(formData, "currency") || "PLN",
    booking_method: text(formData, "booking_method") || "unknown",
    has_paid_offer: checked(formData, "has_paid_offer"),
    requires_schedule: checked(formData, "requires_schedule"),
    group_offer: checked(formData, "group_offer"),
    indoor: checked(formData, "indoor"),
    year_round: checked(formData, "year_round"),
    review_rating: text(formData, "review_rating"),
    review_count: text(formData, "review_count"),
    status: text(formData, "status") || "discovered",
    claim_status: text(formData, "claim_status") || "unclaimed",
    source_notes: text(formData, "source_notes"),
    admin_notes: text(formData, "admin_notes"),
  }

  const { error } = await supabase.rpc("platform_supply_update_lead", {
    p_lead_id: leadId,
    p_data: payload,
  })

  if (error) redirect(`/admin/supply/${leadId}?blad=update`)

  revalidatePath("/admin/supply")
  revalidatePath(`/admin/supply/${leadId}`)
  revalidatePath(`/admin/supply/${leadId}/podglad`)
  redirect(`/admin/supply/${leadId}?zapisano=1`)
}
