"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function submitAttractionInterestAction(slug: string, attractionId: string, formData: FormData) {
  const returnTo = `/attractions/${slug}`
  const email = text(formData, "email")
  const desiredDate = text(formData, "desired_date")
  const partySize = Number(text(formData, "party_size"))
  const honeypot = text(formData, "company_website")

  // Bots commonly fill hidden fields. Behave like a successful submission so the
  // form cannot be used to probe the anti-spam rule.
  if (honeypot) {
    redirect(`${returnTo}?zainteresowanie=1#booking`)
  }

  if (!email || !desiredDate || !Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    redirect(`${returnTo}?blad_zainteresowania=1#booking`)
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("marketplace_register_attraction_interest", {
    p_attraction_id: attractionId,
    p_email: email,
    p_desired_date: desiredDate,
    p_party_size: partySize,
  })

  if (error) {
    console.error("[demand] Failed to register attraction interest", {
      attractionId,
      code: error.code,
    })
    redirect(`${returnTo}?blad_zainteresowania=1#booking`)
  }

  revalidatePath(returnTo)
  revalidatePath("/admin/supply")
  redirect(`${returnTo}?zainteresowanie=1#booking`)
}


export async function startAttractionConversation(formData: FormData) {
  const attractionId = text(formData, "attractionId")
  const requestedReturnTo = text(formData, "returnTo") || "/attractions"
  const returnTo =
    requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/attractions"

  if (!attractionId || !isSupabaseConfigured) {
    redirect(returnTo)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`)
  }

  const { data, error } = await supabase.rpc("marketplace_start_conversation", {
    p_order_id: null,
    p_attraction_id: attractionId,
  })

  if (error || !data) {
    redirect(returnTo)
  }

  redirect(`/messages/${data}`)
}
