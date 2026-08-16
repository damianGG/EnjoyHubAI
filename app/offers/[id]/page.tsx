import { notFound, permanentRedirect } from "next/navigation"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function LegacyOfferRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!isSupabaseConfigured) notFound()

  const { id } = await params
  const supabase = createClient()
  const { data: offer } = await supabase
    .from("offers")
    .select("place_id")
    .eq("id", id)
    .maybeSingle()

  if (!offer?.place_id) notFound()
  permanentRedirect(`/attractions/${offer.place_id}`)
}
