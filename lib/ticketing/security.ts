import { createHmac, timingSafeEqual } from "node:crypto"

function getFingerprintSecret() {
  const secret = process.env.TICKETING_FINGERPRINT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("TICKETING_FINGERPRINT_SECRET musi mieć co najmniej 32 znaki")
  }
  return secret
}

export function createCheckoutFingerprint(value: string) {
  return createHmac("sha256", getFingerprintSecret())
    .update(value)
    .digest("hex")
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  return forwardedFor?.split(",")[0]?.trim() || "unknown"
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")

  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function parseCheckoutCookie(value: string | undefined) {
  if (!value) return null
  const [orderId, holdToken, ...extra] = value.split(".")
  if (!orderId || !holdToken || extra.length > 0) return null
  return { orderId, holdToken }
}

export function checkoutCookieMatches(
  cookie: { orderId: string; holdToken: string } | null,
  orderId: string,
) {
  if (!cookie) return false

  const left = Buffer.from(cookie.orderId)
  const right = Buffer.from(orderId)
  return left.length === right.length && timingSafeEqual(left, right)
}
