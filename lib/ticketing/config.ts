export const isTicketingCheckoutEnabled =
  process.env.TICKETING_CHECKOUT_ENABLED === "true"

export const isTicketingPaymentsEnabled =
  isTicketingCheckoutEnabled && process.env.TICKETING_PAYMENTS_ENABLED === "true"

export const checkoutCookieName = "enjoyhub_checkout"

export const checkoutHoldMinutes = 15

// Stripe Checkout cannot expire sooner than 30 minutes. The database hold is
// extended for five additional minutes so a signed webhook can still convert
// the reserved inventory after the provider session has closed.
export const paymentHoldMinutes = 35
export const stripeCheckoutMinutes = 31

// Until e-mail access links are added, keep the anonymous order cookie long
// enough for a customer to return from payment and reopen issued tickets.
export const checkoutCookieMaxAgeSeconds = 24 * 60 * 60
