export function getEmailSiteUrl() {
  const explicitEmailUrl = normalize(process.env.EMAIL_SITE_URL)
  if (explicitEmailUrl) return explicitEmailUrl

  const siteUrl = normalize(process.env.NEXT_PUBLIC_SITE_URL)
  if (siteUrl) return siteUrl

  const productionUrl = normalizeVercel(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (productionUrl) return productionUrl

  const deploymentUrl = normalizeVercel(process.env.VERCEL_URL)
  if (deploymentUrl) return deploymentUrl

  return "http://localhost:3000"
}

function normalize(value?: string) {
  if (!value) return null
  const trimmed = value.trim().replace(/\/$/, "")
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function normalizeVercel(value?: string) {
  return normalize(value)
}
