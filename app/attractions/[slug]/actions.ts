"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function submitAttractionInterestAction(slug: string, attractionId: string, formData: FormData) {
  const returnTo = `/attractions/${slug}`
  const email = text(formData, "email")
  const desiredDate = text(formData, "desired_date")
  const partySize = Number(text(formData, "party_size"))

  if (!email || !desiredDate || !Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    redirect(`${returnTo}?blad_zainteresowania=1#booking`)
  }

  const supabase = createClient()
  const { error } = await supabase.rpc("marketplace_register_attraction_interest", {
    p_attraction_id: attractionId,
    p_email: email,
    p_desired_date: desiredDate,
    p_party_size: partySize,
  })

  if (error) {
    redirect(`${returnTo}?blad_zainteresowania=1#booking`)
  }

  revalidatePath(returnTo)
  revalidatePath("/admin/supply")
  redirect(`${returnTo}?zainteresowanie=1#booking`)
}
