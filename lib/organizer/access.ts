export const organizerManagementRoles = ["owner", "admin", "manager"] as const
export const organizerSalesRoles = ["owner", "admin", "manager", "viewer"] as const
export const organizerScannerRoles = ["owner", "admin", "manager", "cashier"] as const

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
  cashier: "Kasjer",
  viewer: "Podgląd",
}

export function hasOrganizerRole(
  roles: Iterable<string>,
  allowed: readonly OrganizerRole[],
) {
  const current = new Set(roles)
  return allowed.some((role) => current.has(role))
}
