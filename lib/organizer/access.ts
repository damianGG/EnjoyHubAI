export const organizerManagementRoles = ["owner", "admin", "manager"] as const
export const organizerSalesRoles = ["owner", "admin", "manager", "viewer"] as const
export const organizerScannerRoles = ["owner", "admin", "manager", "cashier"] as const
export const organizerTeamRoles = ["owner", "admin"] as const
export const organizerVerificationRoles = ["owner", "admin"] as const

export type OrganizerRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "viewer"

export const organizerRoleLabels: Record<OrganizerRole, string> = {
  owner: "Właściciel",
  admin: "Administrator",
  manager: "Manager",
  cashier: "Obsługa wejścia",
  viewer: "Podgląd",
}

export const organizerRoleDescriptions: Record<OrganizerRole, string> = {
  owner: "Pełny dostęp, zespół, dane prawne i możliwość nadawania właściciela.",
  admin: "Pełne zarządzanie operacyjne i zespołem, bez przejęcia własności.",
  manager: "Atrakcje, oferty, kalendarz, sprzedaż i skaner. Bez zarządzania zespołem i danymi prawnymi.",
  cashier: "Tylko obsługa wejścia i skanowanie biletów.",
  viewer: "Tylko podgląd sprzedaży i wyników, bez zmian w konfiguracji.",
}

export function hasOrganizerRole(
  roles: Iterable<string>,
  allowed: readonly OrganizerRole[],
) {
  const current = new Set(roles)
  return allowed.some((role) => current.has(role))
}
