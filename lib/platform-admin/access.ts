import { redirect } from "next/navigation"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const platformStaffRoles = [
  "platform_superadmin",
  "platform_support",
  "platform_content",
  "platform_finance",
] as const

export type PlatformStaffRole = (typeof platformStaffRoles)[number]

export const platformStaffRoleLabels: Record<PlatformStaffRole, string> = {
  platform_superadmin: "Super administrator",
  platform_support: "Wsparcie",
  platform_content: "Treści",
  platform_finance: "Finanse",
}

export async function getPlatformStaff() {
  if (!isSupabaseConfigured) return null
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("platform_staff")
    .select("user_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!data) return null
  return {
    user,
    role: data.role as PlatformStaffRole,
    supabase,
  }
}

export async function requirePlatformStaff(
  allowedRoles: readonly PlatformStaffRole[] = platformStaffRoles,
  next = "/admin",
) {
  if (!isSupabaseConfigured) redirect("/")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`)

  const { data } = await supabase
    .from("platform_staff")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  const role = data?.role as PlatformStaffRole | undefined
  if (!role || !allowedRoles.includes(role)) redirect("/dashboard")

  return { supabase, user, role }
}

export function canPlatformSupport(role: PlatformStaffRole) {
  return role === "platform_superadmin" || role === "platform_support"
}

export function canPlatformContent(role: PlatformStaffRole) {
  return role === "platform_superadmin" || role === "platform_support" || role === "platform_content"
}

export function canPlatformFinance(role: PlatformStaffRole) {
  return role === "platform_superadmin" || role === "platform_finance"
}
