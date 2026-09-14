export function getPublicSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate)
    if (normalized) return normalized
  }

  return "http://localhost:3000"
}

function normalizeUrl(value?: string) {
  if (!value) return null
  const trimmed = value.trim().replace(/\/$/, "")
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
