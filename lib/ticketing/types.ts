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

export interface TicketingSetupOrganization {
  id: string
  name: string
}

export interface TicketingSetupVenue {
  id: string
  organizationId: string
  organizationName: string
  name: string
  city: string | null
  salesMode: "native_enjoyhub" | "allocated_quota"
}

export interface TicketingManagedProduct {
  id: string
  name: string
  description: string | null
  status: "draft" | "active" | "archived"
  durationMinutes: number
  venueId: string
  venueName: string
  venueCity: string | null
  venueTimezone: string
  priceFrom: number | null
  currency: string
  activeTicketTypeCount: number
  upcomingSessionCount: number
  nextSessionStartsAt: string | null
}

export interface TicketingProductSalesPage {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  venue: {
    id: string
    name: string
    city: string | null
    addressLine1: string | null
    timezone: string
  }
  ticketTypes: TicketingTicketType[]
  sessions: Array<{
    id: string
    startsAt: string
    endsAt: string
    availableCapacity: number
  }>
}
