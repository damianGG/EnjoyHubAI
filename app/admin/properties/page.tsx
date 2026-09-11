import { redirect } from "next/navigation"

import { requirePlatformStaff } from "@/lib/platform-admin/access"

export default async function LegacyAdminOffersRedirect() {
  await requirePlatformStaff(undefined, "/admin/properties")
  redirect("/admin/organizacje")
}
