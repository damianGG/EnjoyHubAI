import "server-only"

import { getPublicSiteUrl } from "@/lib/site-url"

export function buildSiteEntityJsonLd() {
  const siteUrl = getPublicSiteUrl()
  const organizationId = `${siteUrl}/#organization`
  const websiteId = `${siteUrl}/#website`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "EnjoyHub",
        alternateName: "EnjoyHub.app",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/enjoyhub-icon.svg`,
        },
        description: "Marketplace atrakcji, terminów i biletów online.",
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: "EnjoyHub",
        alternateName: "EnjoyHub.app",
        inLanguage: "pl-PL",
        publisher: { "@id": organizationId },
      },
    ],
  }
}

export function serializeSiteEntityJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}
