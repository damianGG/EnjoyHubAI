import "server-only"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  CANCELLATION_POLICY_VERSION,
  MARKETPLACE_TERMS_VERSION,
  buildCancellationPolicy,
  buildPlatformSnapshot,
  buildSellerSnapshot,
  isMarketplaceLegalContactConfigured,
  type CancellationPolicyCode,
} from "@/lib/legal/marketplace"

interface RawCheckoutLegalSession {
  id: string
  products: {
    id: string
    cancellation_policy_code: CancellationPolicyCode
    cancellation_deadline_hours: number
    cancellation_policy_text: string | null
    venues: {
      organization_id: string
      organizations: {
        id: string
        name: string
        legal_name: string | null
        tax_id: string | null
        billing_email: string | null
        legal_address: string | null
        contact_phone: string | null
        registry_name: string | null
        registry_number: string | null
        verification_status: string
        payments_enabled: boolean
      }
    }
  }
}

export async function getCheckoutLegalContext(sessionId: string) {
  if (!isSupabaseAdminConfigured) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      products!inner (
        id,
        cancellation_policy_code,
        cancellation_deadline_hours,
        cancellation_policy_text,
        venues!inner (
          organization_id,
          organizations!inner (
            id,
            name,
            legal_name,
            tax_id,
            billing_email,
            legal_address,
            contact_phone,
            registry_name,
            registry_number,
            verification_status,
            payments_enabled
          )
        )
      )
    `)
    .eq("id", sessionId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("Checkout legal context lookup failed", { sessionId, code: error.code, message: error.message })
    return null
  }

  const row = data as unknown as RawCheckoutLegalSession
  const product = row.products
  const organization = product.venues.organizations
  const completeSeller = Boolean(
    organization.legal_name?.trim() &&
    organization.tax_id?.trim() &&
    organization.billing_email?.trim() &&
    organization.legal_address?.trim() &&
    organization.contact_phone?.trim(),
  )

  if (!completeSeller) return null

  const seller = buildSellerSnapshot({
    organizationId: organization.id,
    displayName: organization.name,
    legalName: organization.legal_name!,
    taxId: organization.tax_id!,
    billingEmail: organization.billing_email!,
    legalAddress: organization.legal_address!,
    contactPhone: organization.contact_phone!,
    registryName: organization.registry_name,
    registryNumber: organization.registry_number,
  })
  const cancellationPolicy = buildCancellationPolicy({
    code: product.cancellation_policy_code,
    deadlineHours: product.cancellation_deadline_hours,
    customText: product.cancellation_policy_text,
  })

  return {
    termsVersion: MARKETPLACE_TERMS_VERSION,
    cancellationPolicyVersion: CANCELLATION_POLICY_VERSION,
    seller,
    cancellationPolicy,
    platform: buildPlatformSnapshot(),
    platformContactConfigured: isMarketplaceLegalContactConfigured,
    sellerVerified: organization.verification_status === "verified" && organization.payments_enabled,
  }
}
