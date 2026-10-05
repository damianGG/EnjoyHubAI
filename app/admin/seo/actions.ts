"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { submitIndexNowForAttractionId, submitIndexNowSeoSnapshot } from "@/lib/seo/indexnow"
import { getSeoQualityDashboard } from "@/lib/seo/quality"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { createAdminClient } from "@/lib/supabase/admin"

const seoRoles = ["platform_superadmin", "platform_content"] as const

export async function setSeoIndexedAction(propertyId: string, indexed: boolean, _formData: FormData) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const patch = indexed
    ? { seo_indexed: true, seo_indexed_at: now, seo_excluded: false, updated_at: now }
    : { seo_indexed: false, seo_indexed_at: null, updated_at: now }

  const { error } = await admin
    .from("properties")
    .update(patch)
    .eq("id", propertyId)

  if (error) {
    console.error("[admin:seo] Failed to change manual indexing state", error)
    redirect("/admin/seo?blad=seo-indexed")
  }

  revalidatePath("/admin/seo")
  revalidatePath("/attractions")
  revalidatePath("/sitemap.xml")

  // When disabling indexing, still submit the URL once so crawlers can see noindex.
  await submitIndexNowForAttractionId(propertyId, { includeUnindexed: !indexed })
}

export async function publishRecommendedSeoAction(_formData: FormData) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const admin = createAdminClient()
  const dashboard = await getSeoQualityDashboard()
  const ids = dashboard.profiles
    .filter((profile) => profile.seoEligible && !profile.seoIndexed && !profile.seoExcluded)
    .map((profile) => profile.id)

  if (ids.length === 0) redirect("/admin/seo?opublikowano=0")

  const now = new Date().toISOString()
  for (let index = 0; index < ids.length; index += 200) {
    const { error } = await admin
      .from("properties")
      .update({ seo_indexed: true, seo_indexed_at: now, seo_excluded: false, updated_at: now })
      .in("id", ids.slice(index, index + 200))

    if (error) {
      console.error("[admin:seo] Failed to publish recommended profiles", error)
      redirect("/admin/seo?blad=publish-recommended")
    }
  }

  revalidatePath("/admin/seo")
  revalidatePath("/attractions")
  revalidatePath("/sitemap.xml")
  await submitIndexNowSeoSnapshot()
  redirect(`/admin/seo?opublikowano=${ids.length}&status=recommended`)
}

export async function setSeoExcludedAction(propertyId: string, excluded: boolean, _formData: FormData) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin
    .from("properties")
    .update({
      seo_excluded: excluded,
      ...(excluded ? { seo_indexed: false, seo_indexed_at: null } : {}),
      updated_at: now,
    })
    .eq("id", propertyId)

  if (error) {
    console.error("[admin:seo] Failed to change SEO exclusion", error)
    redirect("/admin/seo?blad=seo-excluded")
  }

  revalidatePath("/admin/seo")
  revalidatePath("/attractions")
  revalidatePath("/sitemap.xml")
  await submitIndexNowForAttractionId(propertyId, { includeUnindexed: excluded })
}

export async function submitSeoSnapshotToIndexNowAction(_formData: FormData) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const result = await submitIndexNowSeoSnapshot()

  revalidatePath("/admin/seo")
  const status = result.ok ? "ok" : "partial"
  redirect(`/admin/seo?indexnow=${status}&wyslano=${result.submitted}`)
}
