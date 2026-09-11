"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requirePlatformStaff } from "@/lib/platform-admin/access"

const organizationRoles = ["owner", "admin", "manager", "cashier", "viewer"] as const
const verificationStatuses = ["not_started", "pending", "verified", "rejected"] as const
const organizationStatuses = ["active", "suspended"] as const

function adminError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? ""
  if (error?.code === "42501") return "uprawnienia"
  if (error?.code === "P0002") return "nie_znaleziono"
  if (message.includes("last organization owner")) return "ostatni_wlasciciel"
  if (message.includes("existing account")) return "brak_konta"
  return "blad"
}

export async function createOrganizationAction(formData: FormData) {
  const parsed = z.object({
    name: z.string().trim().min(2).max(160),
    ownerEmail: z.union([z.string().trim().email().max(320), z.literal("")]),
  }).safeParse({
    name: String(formData.get("name") ?? ""),
    ownerEmail: String(formData.get("ownerEmail") ?? ""),
  })
  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const { supabase } = await requirePlatformStaff(["platform_superadmin", "platform_support"], "/admin/organizacje")
  const { data, error } = await supabase.rpc("platform_admin_create_organization", {
    p_name: parsed.data.name,
    p_owner_email: parsed.data.ownerEmail || null,
  })
  if (error || !data) redirect(`/admin/organizacje?blad=${adminError(error)}`)

  revalidatePath("/admin")
  revalidatePath("/admin/organizacje")
  redirect(`/admin/organizacje/${data}?ok=utworzono`)
}

export async function assignOrganizationMemberAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    email: z.string().trim().email().max(320),
    role: z.enum(organizationRoles),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  })
  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const next = `/admin/organizacje/${parsed.data.organizationId}`
  const { supabase } = await requirePlatformStaff(["platform_superadmin", "platform_support"], next)
  const { error } = await supabase.rpc("platform_admin_assign_member", {
    p_organization_id: parsed.data.organizationId,
    p_user_email: parsed.data.email,
    p_role: parsed.data.role,
  })
  if (error) redirect(`${next}?blad=${adminError(error)}`)

  revalidatePath(next)
  revalidatePath("/admin/uzytkownicy")
  redirect(`${next}?ok=przypisano`)
}

export async function updateOrganizationAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
    status: z.enum(organizationStatuses),
    verificationStatus: z.enum(verificationStatuses),
    paymentsEnabled: z.enum(["true", "false"]),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    name: String(formData.get("name") ?? ""),
    status: String(formData.get("status") ?? ""),
    verificationStatus: String(formData.get("verificationStatus") ?? ""),
    paymentsEnabled: String(formData.get("paymentsEnabled") ?? "false"),
  })
  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const next = `/admin/organizacje/${parsed.data.organizationId}`
  const { supabase } = await requirePlatformStaff([
    "platform_superadmin",
    "platform_support",
    "platform_finance",
  ], next)
  const { error } = await supabase.rpc("platform_admin_update_organization", {
    p_organization_id: parsed.data.organizationId,
    p_name: parsed.data.name,
    p_status: parsed.data.status,
    p_verification_status: parsed.data.verificationStatus,
    p_payments_enabled: parsed.data.paymentsEnabled === "true",
  })
  if (error) redirect(`${next}?blad=${adminError(error)}`)

  revalidatePath(next)
  revalidatePath("/admin/organizacje")
  redirect(`${next}?ok=zapisano`)
}

export async function createVenueAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
    address: z.string().trim().max(240),
    postalCode: z.string().trim().max(24),
    city: z.string().trim().max(120),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    city: String(formData.get("city") ?? ""),
  })
  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const next = `/admin/organizacje/${parsed.data.organizationId}`
  const { supabase } = await requirePlatformStaff([
    "platform_superadmin",
    "platform_support",
    "platform_content",
  ], next)
  const { error } = await supabase.rpc("platform_admin_create_venue", {
    p_organization_id: parsed.data.organizationId,
    p_name: parsed.data.name,
    p_address: parsed.data.address || null,
    p_postal_code: parsed.data.postalCode || null,
    p_city: parsed.data.city || null,
  })
  if (error) redirect(`${next}?blad=${adminError(error)}`)

  revalidatePath(next)
  redirect(`${next}?ok=obiekt`)
}

export async function createAttractionDraftAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    venueId: z.string().uuid(),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(3000),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    venueId: String(formData.get("venueId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
  })
  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const next = `/admin/organizacje/${parsed.data.organizationId}`
  const { supabase } = await requirePlatformStaff([
    "platform_superadmin",
    "platform_support",
    "platform_content",
  ], next)
  const { error } = await supabase.rpc("platform_admin_create_attraction_draft", {
    p_venue_id: parsed.data.venueId,
    p_title: parsed.data.title,
    p_description: parsed.data.description || null,
  })
  if (error) redirect(`${next}?blad=${adminError(error)}`)

  revalidatePath(next)
  redirect(`${next}?ok=atrakcja`)
}

export async function activateSupportContextAction(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().uuid() }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
  })
  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const { supabase } = await requirePlatformStaff(["platform_superadmin", "platform_support"], "/admin/organizacje")
  const { error } = await supabase.rpc("platform_admin_set_support_context", {
    p_organization_id: parsed.data.organizationId,
  })
  if (error) redirect(`/admin/organizacje/${parsed.data.organizationId}?blad=${adminError(error)}`)

  revalidatePath("/admin")
  redirect(`/admin/wsparcie/${parsed.data.organizationId}`)
}

export async function clearSupportContextAction() {
  const { supabase } = await requirePlatformStaff(["platform_superadmin", "platform_support"], "/admin")
  await supabase.rpc("platform_admin_clear_support_context")
  revalidatePath("/admin")
  redirect("/admin/organizacje")
}
