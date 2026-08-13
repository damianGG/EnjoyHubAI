import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"

interface BookPageProps {
  params: Promise<{
    offerId: string
  }>
  searchParams: Promise<{
    date?: string
    slots?: string
    people?: string
  }>
}

/**
 * Booking page that handles redirects from multi-slot booking widget.
 * This page receives booking parameters via query params and redirects to the offer page.
 * The actual booking happens on the offer detail page (/offers/[id]) which has the BookingWidget.
 */
export default async function OfferBookPage({ params, searchParams }: BookPageProps) {
  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams)
  
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = await createClient()

  // Verify the offer exists
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id, is_active")
    .eq("id", resolvedParams.offerId)
    .eq("is_active", true)
    .single()

  if (error || !offer) {
    notFound()
  }

  // Redirect to the offer page where the booking can be completed
  // Pass query params if provided (for pre-selecting date/time)
  const queryParams = new URLSearchParams()
  
  if (resolvedSearchParams.date) {
    queryParams.set("date", resolvedSearchParams.date)
  }
  if (resolvedSearchParams.slots) {
    queryParams.set("slots", resolvedSearchParams.slots)
  }
  if (resolvedSearchParams.people) {
    queryParams.set("people", resolvedSearchParams.people)
  }

  const queryString = queryParams.toString()
  const redirectUrl = `/offers/${resolvedParams.offerId}${queryString ? `?${queryString}` : ''}`
  
  redirect(redirectUrl)
}
