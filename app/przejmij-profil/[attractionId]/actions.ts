"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function submitProfileClaimAction(attractionId: string, formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const returnTo = `/przejmij-profil/${attractionId}`

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`)
  }

  const { error } = await supabase.rpc("profile_claim_submit", {
    p_attraction_id: attractionId,
    p_claimant_phone: text(formData, "phone") || null,
    p_message: text(formData, "message") || null,
  })

  if (error) {
    redirect(`${returnTo}?blad=1`)
  }

  revalidatePath(returnTo)
  revalidatePath(`/attractions/${attractionId}`)
  redirect(`${returnTo}?wyslano=1`)
}
