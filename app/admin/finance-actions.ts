"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requirePlatformStaff } from "@/lib/platform-admin/access"

const verificationStatuses = ["not_started", "pending", "verified", "rejected"] as const

export async function updateOrganizationFinanceAction(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    verificationStatus: z.enum(verificationStatuses),
    paymentsEnabled: z.enum(["true", "false"]),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    verificationStatus: String(formData.get("verificationStatus") ?? ""),
    paymentsEnabled: String(formData.get("paymentsEnabled") ?? "false"),
  })

  if (!parsed.success) redirect("/admin/organizacje?blad=dane")

  const next = `/admin/organizacje/${parsed.data.organizationId}`
  const { supabase } = await requirePlatformStaff(["platform_superadmin", "platform_finance"], next)
  const { error } = await supabase.rpc("platform_admin_update_organization", {
    p_organization_id: parsed.data.organizationId,
    p_name: null,
    p_status: null,
    p_verification_status: parsed.data.verificationStatus,
    p_payments_enabled: parsed.data.paymentsEnabled === "true",
  })

  if (error) redirect(`${next}?blad=finanse`)

  revalidatePath(next)
  revalidatePath("/admin/organizacje")
  revalidatePath("/admin")
  redirect(`${next}?ok=finanse`)
}
