"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function submitVerifiedReviewAction(token: string, propertyId: string, formData: FormData) {
  const rating = Number(text(formData, "rating"))
  const comment = text(formData, "comment")

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 3 || comment.length > 2000) {
    redirect(`/opinia/${token}?blad=1`)
  }

  const supabase = createClient()
  const { error } = await supabase.rpc("review_submit_verified", {
    p_token: token,
    p_rating: rating,
    p_comment: comment,
  })

  if (error) {
    console.error("Verified review submission failed", {
      code: error.code,
      message: error.message,
    })
    redirect(`/opinia/${token}?blad=1`)
  }

  revalidatePath(`/attractions/${propertyId}`)
  redirect(`/opinia/${token}?dziekujemy=1`)
}
