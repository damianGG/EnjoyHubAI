export const DEFAULT_AUTH_RETURN_TO = "/dashboard"

const returnToOrigin = "https://return.enjoyhub.local"

export function getSafeAuthReturnTo(value: unknown) {
  if (typeof value !== "string") return DEFAULT_AUTH_RETURN_TO

  const candidate = value.trim()
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_AUTH_RETURN_TO
  }

  try {
    const parsed = new URL(candidate, returnToOrigin)
    if (parsed.origin !== returnToOrigin) return DEFAULT_AUTH_RETURN_TO

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return DEFAULT_AUTH_RETURN_TO
  }
}
