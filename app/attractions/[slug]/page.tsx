import { notFound, permanentRedirect } from "next/navigation"

import { getAttractionCanonicalPath, getPublicAttractionSeoRecord } from "@/lib/seo/attraction"
import { extractIdFromSlug } from "@/lib/utils"

export const dynamic = "force-static"
export const revalidate = 120

export default async function LegacyAttractionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const id = extractIdFromSlug(slug)
  const attraction = await getPublicAttractionSeoRecord(id)

  if (!attraction) notFound()
  permanentRedirect(getAttractionCanonicalPath(attraction))
}
