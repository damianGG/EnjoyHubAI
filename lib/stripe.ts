import Stripe from "stripe"

export const isStripeConfigured =
  typeof process.env.STRIPE_SECRET_KEY === "string" &&
  process.env.STRIPE_SECRET_KEY.startsWith("sk_")

export const isStripeWebhookConfigured =
  typeof process.env.STRIPE_WEBHOOK_SECRET === "string" &&
  process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")

let stripeClient: Stripe | null = null

export function getStripeClient() {
  if (!isStripeConfigured) {
    throw new Error("Brak konfiguracji Stripe")
  }

  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
    appInfo: {
      name: "EnjoyHub",
      version: "1d",
    },
  })

  return stripeClient
}
