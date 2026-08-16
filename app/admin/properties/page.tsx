import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export default async function LegacyAdminOffersRedirect() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "super_admin") redirect("/dashboard")

  redirect("/host/sprzedaz/konfiguracja")
}
