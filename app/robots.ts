import type { MetadataRoute } from "next"

import { getPublicSiteUrl } from "@/lib/site-url"

const DISALLOW_PATHS = [
  "/admin",
  "/api",
  "/auth",
  "/bilet",
  "/checkout",
  "/dashboard",
  "/host",
  "/opinia",
  "/przejmij-profil",
  "/widget",
  "/login",
  "/register",
  "/reset-password",
  "/forgot-password",
]

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
