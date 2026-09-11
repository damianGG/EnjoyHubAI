import { createClient } from "@/lib/supabase/server"

export async function getPlatformContentApiClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staff } = await supabase
    .from("platform_staff")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!staff || !["platform_superadmin", "platform_content"].includes(staff.role)) return null
  return supabase
}
