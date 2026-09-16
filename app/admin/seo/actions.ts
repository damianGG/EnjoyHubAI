"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { submitIndexNowForAttractionId, submitIndexNowSeoSnapshot } from "@/lib/seo/indexnow"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { createAdminClient } from "@/lib/supabase/admin"

const seoRoles = ["platform_superadmin", "platform_content"] as const

export async function setSeoExcludedAction(propertyId: string, excluded: boolean, _formData: FormData) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const admin = createAdminClient()

  const { error } = await admin
    .from("properties")
    .update({ seo_excluded: excluded, updated_at: new Date().toISOString() })
    .eq("id", propertyId)

  if (error) {
    console.error("[admin:seo] Failed to change SEO exclusion", error)
    redirect("/admin/seo?blad=seo-excluded")
  }

  revalidatePath("/admin/seo")
  revalidatePath("/attractions")
  revalidatePath("/sitemap.xml")
  await submitIndexNowForAttractionId(propertyId)
}

export async function submitSeoSnapshotToIndexNowAction(_formData: FormData) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const result = await submitIndexNowSeoSnapshot()

  revalidatePath("/admin/seo")
  const status = result.ok ? "ok" : "partial"
  redirect(`/admin/seo?indexnow=${status}&wyslano=${result.submitted}`)
}
