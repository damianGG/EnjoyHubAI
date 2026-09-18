"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

function clean(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

export async function updateProfileAction(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/dashboard/profile?error=service")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/dashboard/profile")

  const fullName = clean(formData.get("full_name"), 120)
  const phone = clean(formData.get("phone"), 30)
  const bio = clean(formData.get("bio"), 500)

  if (fullName.length > 0 && fullName.length < 2) {
    redirect("/dashboard/profile?error=validation")
  }

  const { error } = await supabase
    .from("users")
    .update({
      full_name: fullName || null,
      phone: phone || null,
      bio: bio || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    console.error("[profile] Failed to update profile", error)
    redirect("/dashboard/profile?error=save")
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/profile")
  redirect("/dashboard/profile?saved=1")
}
