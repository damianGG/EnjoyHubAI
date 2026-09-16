const CANONICAL_PRODUCTION_SITE_URL = "https://www.enjoyhub.app"

export function getPublicSiteUrl() {
  // Vercel's project production URL can be a *.vercel.app alias. For SEO-facing
  // output (canonical URLs, sitemap, robots, JSON-LD, IndexNow) production must
  // always advertise the real public domain.
  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_PRODUCTION_SITE_URL
  }

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate)
    if (normalized) return normalized
  }

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_PRODUCTION_SITE_URL
  }

  return "http://localhost:3000"
}

function normalizeUrl(value?: string) {
  if (!value) return null
  const trimmed = value.trim().replace(/\/$/, "")
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
