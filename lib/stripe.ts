import Stripe from "stripe"

export const isStripeConfigured =
  typeof process.env.STRIPE_SECRET_KEY === "string" &&
  process.env.STRIPE_SECRET_KEY.startsWith("sk_")

export const isStripeWebhookConfigured =
  typeof process.env.STRIPE_WEBHOOK_SECRET === "string" &&
  process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")

export const isStripeConnectWebhookConfigured =
  typeof process.env.STRIPE_CONNECT_WEBHOOK_SECRET === "string" &&
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET.startsWith("whsec_")

type LegacyConnectedBalanceParams = { stripeAccount: string }
type CompatibleBalance = Omit<Stripe["balance"], "retrieve"> & {
  retrieve(
    params?: Stripe.BalanceRetrieveParams | LegacyConnectedBalanceParams,
    options?: Stripe.RequestOptions,
  ): Promise<Stripe.Response<Stripe.Balance>>
}
type EnjoyHubStripeClient = Omit<Stripe, "balance"> & { balance: CompatibleBalance }

let stripeClient: EnjoyHubStripeClient | null = null

function createStripeClient(): EnjoyHubStripeClient {
  const client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
    appInfo: {
      name: "EnjoyHub",
      version: "1e-connect",
    },
  })

  // Stripe v22 expects the connected account in request options. Two existing
  // EnjoyHub call sites used the older one-object shape. Normalize that legacy
  // shape here so the request is sent correctly while those callers stay stable.
  const nativeBalanceRetrieve = client.balance.retrieve.bind(client.balance)
  const compatibleBalance = client.balance as CompatibleBalance
  compatibleBalance.retrieve = ((
    params: Stripe.BalanceRetrieveParams | LegacyConnectedBalanceParams = {},
    options?: Stripe.RequestOptions,
  ) => {
    if ("stripeAccount" in params) {
      const { stripeAccount } = params
      return nativeBalanceRetrieve({}, { ...options, stripeAccount })
    }
    return nativeBalanceRetrieve(params, options)
  }) as CompatibleBalance["retrieve"]

  return client as EnjoyHubStripeClient
}

export function getStripeClient(): EnjoyHubStripeClient {
  if (!isStripeConfigured) {
    throw new Error("Brak konfiguracji Stripe")
  }

  stripeClient ??= createStripeClient()
  return stripeClient
}
