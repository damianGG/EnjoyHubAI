"use server"

import { redirect } from "next/navigation"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function startOrderConversation(formData: FormData) {
  const orderId = String(formData.get("orderId") || "")
  if (!orderId || !isSupabaseConfigured) {
    redirect("/dashboard/bookings")
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?next=/dashboard/bookings")
  }

  const { data, error } = await supabase.rpc("marketplace_start_conversation", {
    p_order_id: orderId,
    p_attraction_id: null,
  })

  if (error || !data) {
    redirect("/dashboard/bookings?messageError=1")
  }

  redirect(`/messages/${data}`)
}
