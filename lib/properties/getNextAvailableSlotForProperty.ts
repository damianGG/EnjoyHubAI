import { listMarketplacePropertySessions } from "@/lib/ticketing/marketplace"

/**
 * Returns the next sellable canonical ticketing session for a public property.
 */
export async function getNextAvailableSlotForProperty(
  propertyId: string,
  dateStart: string,
  dateEnd: string,
): Promise<{
  date: string
  startTime: string
  sessionId: string
  productId: string
  price_from: number
} | null> {
  const sessions = await listMarketplacePropertySessions(
    propertyId,
    dateStart,
    dateEnd,
  )
  const session = sessions[0]
  if (!session) return null

  return {
    date: session.localDate,
    startTime: session.localStartTime,
    sessionId: session.id,
    productId: session.productId,
    price_from: session.priceFrom,
  }
}
