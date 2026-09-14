export const MARKETPLACE_TERMS_VERSION = "2026-09-14-v1"
export const CANCELLATION_POLICY_VERSION = "2026-09-14-v1"
export const LEGAL_EFFECTIVE_DATE = "14 września 2026 r."

export const platformOperator = {
  brand: "EnjoyHub",
  legalName: "Codeli sp. z o.o.",
  address: "ul. Fabryczna 4 lok. 35, 39-120 Sędziszów Małopolski, Polska",
  taxId: "8181738238",
  krs: "0001129938",
  regon: "529768734",
  email: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ?? "",
  phone: process.env.NEXT_PUBLIC_LEGAL_CONTACT_PHONE?.trim() ?? "",
} as const

export const isMarketplaceLegalContactConfigured = Boolean(
  platformOperator.email && platformOperator.phone,
)

export type CancellationPolicyCode = "flexible_24h" | "non_refundable" | "custom"

export interface CancellationPolicySource {
  code: CancellationPolicyCode
  deadlineHours: number
  customText?: string | null
}

export interface CancellationPolicySnapshot {
  code: CancellationPolicyCode
  version: string
  title: string
  shortSummary: string
  fullText: string
  deadlineHours: number
  statutoryWithdrawalNotice: string
}

const withdrawalNotice =
  "Jeżeli rezerwacja dotyczy usługi związanej z wypoczynkiem, wydarzeniem rozrywkowym, sportowym lub kulturalnym świadczonej w oznaczonym dniu albo okresie, ustawowe 14-dniowe prawo odstąpienia od umowy zawartej na odległość co do zasady nie przysługuje. Dobrowolne prawo anulowania wynika z zasad pokazanych przy danej ofercie."

export function buildCancellationPolicy(source: CancellationPolicySource): CancellationPolicySnapshot {
  if (source.code === "non_refundable") {
    return {
      code: source.code,
      version: CANCELLATION_POLICY_VERSION,
      title: "Oferta bezzwrotna",
      shortSummary: "Po opłaceniu rezerwacji klient nie ma dobrowolnego prawa do anulowania z refundem, chyba że organizator odwoła usługę lub bezwzględnie obowiązujące przepisy stanowią inaczej.",
      fullText: "Rezerwacja jest bezzwrotna z inicjatywy klienta. Jeżeli organizator odwoła usługę albo nie będzie mógł jej wykonać zgodnie z umową, klient otrzyma zwrot należnej kwoty. Organizator może dobrowolnie przyznać refund w indywidualnym przypadku.",
      deadlineHours: 0,
      statutoryWithdrawalNotice: withdrawalNotice,
    }
  }

  if (source.code === "custom") {
    const text = source.customText?.trim() || "Indywidualne zasady anulowania zostaną wskazane w ofercie."
    return {
      code: source.code,
      version: CANCELLATION_POLICY_VERSION,
      title: "Indywidualne zasady anulowania",
      shortSummary: text,
      fullText: text,
      deadlineHours: Math.max(0, source.deadlineHours),
      statutoryWithdrawalNotice: withdrawalNotice,
    }
  }

  const deadlineHours = Math.max(1, source.deadlineHours || 24)
  return {
    code: "flexible_24h",
    version: CANCELLATION_POLICY_VERSION,
    title: `Bezpłatne anulowanie do ${deadlineHours} h przed terminem`,
    shortSummary: `Pełny zwrot przy anulowaniu najpóźniej ${deadlineHours} h przed rozpoczęciem atrakcji. Później refund zależy od decyzji organizatora, chyba że to organizator odwoła usługę.`,
    fullText: `Klient może zrezygnować z rezerwacji i otrzymać pełny zwrot zapłaconej kwoty, jeżeli zgłoszenie anulowania dotrze do organizatora lub EnjoyHub najpóźniej ${deadlineHours} godzin przed godziną rozpoczęcia usługi. Po tym terminie nie ma automatycznego prawa do refundu, ale organizator może go przyznać dobrowolnie. Jeżeli organizator odwoła usługę albo nie może wykonać jej zgodnie z umową, klient otrzymuje pełny zwrot należnej kwoty.`,
    deadlineHours,
    statutoryWithdrawalNotice: withdrawalNotice,
  }
}

export function buildPlatformSnapshot() {
  return {
    brand: platformOperator.brand,
    legal_name: platformOperator.legalName,
    address: platformOperator.address,
    tax_id: platformOperator.taxId,
    krs: platformOperator.krs,
    regon: platformOperator.regon,
    email: platformOperator.email || null,
    phone: platformOperator.phone || null,
    role: "marketplace_operator",
    responsibility: "EnjoyHub prowadzi platformę, obsługuje proces rezerwacji i płatności oraz może pośredniczyć w obsłudze refundów. Sprzedawcą i wykonawcą usługi atrakcji jest organizator wskazany przy ofercie i w checkoutcie.",
  }
}

export function buildSellerSnapshot(input: {
  organizationId: string
  displayName: string
  legalName: string
  taxId: string
  billingEmail: string
  legalAddress: string
  contactPhone: string
  registryName?: string | null
  registryNumber?: string | null
}) {
  return {
    organization_id: input.organizationId,
    display_name: input.displayName,
    legal_name: input.legalName,
    tax_id: input.taxId,
    email: input.billingEmail,
    legal_address: input.legalAddress,
    contact_phone: input.contactPhone,
    registry_name: input.registryName ?? null,
    registry_number: input.registryNumber ?? null,
    trader: true,
    role: "service_provider_and_seller",
  }
}
