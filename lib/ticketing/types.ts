export interface TicketingTicketType {
  id: string
  name: string
  description: string | null
  priceAmount: number
  currency: string
  capacityUnits: number
  minQuantity: number
  maxQuantity: number | null
}

export interface TicketingCheckoutSession {
  id: string
  startsAt: string
  endsAt: string
  capacity: number
  availableCapacity: number
  product: {
    id: string
    name: string
    description: string | null
    durationMinutes: number
    minParticipants: number
    maxParticipants: number | null
  }
  venue: {
    id: string
    name: string
    city: string | null
    addressLine1: string | null
    timezone: string
  }
  ticketTypes: TicketingTicketType[]
}

export interface TicketingSessionListItem {
  id: string
  startsAt: string
  endsAt: string
  availableCapacity: number
  productName: string
  venueName: string
  city: string | null
  timezone: string
  priceFrom: number | null
  currency: string
}

export interface CheckoutOrderResult {
  orderId: string
  orderNumber: number
  expiresAt: string
  totalAmount: number
  currency: string
  availableCapacity: number
}

export interface CheckoutOrderSummary {
  id: string
  orderNumber: number
  status: string
  paymentStatus: string
  customerName: string
  customerEmail: string
  totalAmount: number
  currency: string
  expiresAt: string | null
  createdAt: string
  holdStatus: string
  holdExpiresAt: string
  venueName: string
  venueTimezone: string
  items: Array<{
    id: string
    productName: string
    ticketTypeName: string
    quantity: number
    unitPriceAmount: number
    totalPriceAmount: number
    startsAt: string
  }>
  tickets: Array<{
    id: string
    ticketCode: string
    sequenceNumber: number
    status: string
    productName: string
    ticketTypeName: string
    startsAt: string
  }>
}

export interface PublicTicketSummary {
  ticketCode: string
  status: string
  issuedAt: string
  usedAt: string | null
  sequenceNumber: number
  productName: string
  ticketTypeName: string
  startsAt: string
  venueName: string
  venueCity: string | null
  venueTimezone: string
}
