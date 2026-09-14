"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import {
  createOrganizerMarketplacePayout,
  releaseEligibleMarketplaceSettlements,
} from "@/lib/marketplace/settlements"
import { organizerVerificationRoles } from "@/lib/organizer/access"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe"
import {
  isStripeConnectEnabled,
  setStripeConnectManualPayoutSchedule,
  syncStripeConnectAccount,
} from "@/lib/stripe-connect"

const organizationSchema = z.object({ organizationId: z.string().uuid() })

async function requireFinanceOrganization(formData: FormData) {
  const parsed = organizationSchema.safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
  })
  if (!parsed.success) redirect("/host/rozliczenia?blad=organizacja")
  if (!isSupabaseConfigured) redirect("/host/rozliczenia?blad=konfiguracja")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/rozliczenia")

  const { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", parsed.data.organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (
    error ||
    !membership ||
    !organizerVerificationRoles.includes(membership.role as (typeof organizerVerificationRoles)[number])
  ) {
    redirect("/host/rozliczenia?blad=uprawnienia")
  }

  return { organizationId: parsed.data.organizationId, user }
}

function requestOrigin(headerStore: Awaited<ReturnType<typeof headers>>) {
  const origin = headerStore.get("origin")
  if (origin) return origin
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export async function startStripeConnectOnboarding(formData: FormData) {
  const { organizationId, user } = await requireFinanceOrganization(formData)
  if (!isStripeConnectEnabled || !isStripeConfigured || !isSupabaseAdminConfigured) {
    redirect(`/host/rozliczenia?blad=connect&organization=${organizationId}`)
  }

  const admin = createAdminClient()
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, name, billing_email")
    .eq("id", organizationId)
    .single()

  if (organizationError || !organization) {
    redirect("/host/rozliczenia?blad=organizacja")
  }

  const { data: existingAccount, error: existingError } = await admin
    .from("organization_payment_accounts")
    .select("provider_account_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingError) redirect(`/host/rozliczenia?blad=baza&organization=${organizationId}`)

  const stripe = getStripeClient()
  let accountId = existingAccount?.provider_account_id ?? null
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "PL",
      email: organization.billing_email ?? user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        product_description: "Sprzedaż biletów i rezerwacji atrakcji przez EnjoyHub",
      },
      metadata: {
        organization_id: organizationId,
        organization_name: organization.name.slice(0, 120),
        platform: "enjoyhub",
      },
    }, {
      idempotencyKey: `enjoyhub-connect-account-${organizationId}`,
    })
    accountId = account.id

    const { error: saveError } = await admin
      .from("organization_payment_accounts")
      .upsert({
        organization_id: organizationId,
        provider: "stripe",
        provider_account_id: accountId,
      }, { onConflict: "organization_id" })

    if (saveError) throw new Error(`Could not persist Stripe connected account: ${saveError.message}`)
  }

  try {
    await setStripeConnectManualPayoutSchedule(accountId)
  } catch (error) {
    // Some payout settings become editable only after more onboarding data is
    // present. syncStripeConnectAccount retries before marking the account ready.
    console.warn("Initial manual payout schedule setup deferred", { organizationId, accountId, error })
  }
  await syncStripeConnectAccount(organizationId, accountId)

  const headerStore = await headers()
  const origin = requestOrigin(headerStore)
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/host/rozliczenia?stripe=odswiez&organization=${organizationId}`,
    return_url: `${origin}/host/rozliczenia?stripe=powrot&organization=${organizationId}`,
    type: "account_onboarding",
  })

  redirect(accountLink.url)
}

export async function openStripeExpressDashboard(formData: FormData) {
  const { organizationId } = await requireFinanceOrganization(formData)
  if (!isStripeConnectEnabled || !isStripeConfigured || !isSupabaseAdminConfigured) {
    redirect(`/host/rozliczenia?blad=connect&organization=${organizationId}`)
  }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from("organization_payment_accounts")
    .select("provider_account_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!account?.provider_account_id) {
    redirect(`/host/rozliczenia?blad=brak-konta&organization=${organizationId}`)
  }

  const loginLink = await getStripeClient().accounts.createLoginLink(account.provider_account_id)
  redirect(loginLink.url)
}

export async function requestOrganizerPayout(formData: FormData) {
  const { organizationId, user } = await requireFinanceOrganization(formData)
  if (!isStripeConnectEnabled || !isStripeConfigured || !isSupabaseAdminConfigured) {
    redirect(`/host/rozliczenia?blad=connect&organization=${organizationId}`)
  }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from("organization_payment_accounts")
    .select("provider_account_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!account?.provider_account_id) {
    redirect(`/host/rozliczenia?blad=brak-konta&organization=${organizationId}`)
  }

  try {
    await syncStripeConnectAccount(organizationId, account.provider_account_id)
    await releaseEligibleMarketplaceSettlements(100, organizationId)
    const payout = await createOrganizerMarketplacePayout(organizationId, user.id, "PLN")
    revalidatePath("/host/rozliczenia")
    revalidatePath("/host/sprzedaz")
    redirect(`/host/rozliczenia?status=wyplata&organization=${organizationId}&kwota=${payout.amountMinor}`)
  } catch (error) {
    // redirect() throws a framework control-flow error. Never turn a successful
    // redirect into a payout error.
    if (typeof error === "object" && error && "digest" in error) throw error
    console.error("Organizer payout request failed", { organizationId, error })
    redirect(`/host/rozliczenia?blad=wyplata&organization=${organizationId}`)
  }
}
