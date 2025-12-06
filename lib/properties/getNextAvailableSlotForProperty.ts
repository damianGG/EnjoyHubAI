import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getNextAvailableSlot } from "@/lib/offers/getNextAvailableSlot"

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

/**
 * Gets the next available slot across all active offers for a property
 * @param propertyId - The ID of the property
 * @param dateStart - Start date in YYYY-MM-DD format
 * @param dateEnd - End date in YYYY-MM-DD format
 * @returns Object with date, startTime, offerId, and price_from, or null if none found
 */
export async function getNextAvailableSlotForProperty(
  propertyId: string,
  dateStart: string,
  dateEnd: string
): Promise<{
  date: string
  startTime: string
  offerId: string
  price_from: number
} | null> {
  const supabase = createSupabaseServerClient()

  // Fetch all active offers for the property
  const { data: offers, error: offersError } = await supabase
    .from("offers")
    .select("id, base_price")
    .eq("place_id", propertyId)
    .eq("is_active", true)

  if (offersError || !offers || offers.length === 0) {
    console.error("Offers fetch error:", offersError)
    return null
  }

  // For each offer, get the next available slot
  const slotPromises = offers.map(async (offer) => {
    const slot = await getNextAvailableSlot(offer.id, dateStart, dateEnd)
    if (slot) {
      return {
        ...slot,
        offerId: offer.id,
        price_from: offer.base_price,
      }
    }
    return null
  })

  const slots = await Promise.all(slotPromises)

  // Filter out null results
  const validSlots = slots.filter((slot) => slot !== null) as Array<{
    date: string
    startTime: string
    offerId: string
    price_from: number
  }>

  // If no slots found, return null
  if (validSlots.length === 0) {
    return null
  }

  // Sort by date first, then by startTime to find the earliest slot
  validSlots.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) {
      return dateCompare
    }
    return a.startTime.localeCompare(b.startTime)
  })

  // Return the earliest slot
  return validSlots[0]
}
