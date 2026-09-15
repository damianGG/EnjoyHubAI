export type ClientAnalyticsEventName =
  | "attraction_viewed"
  | "availability_viewed"
  | "checkout_started"

const SESSION_KEY = "eh_analytics_session_id"
const ATTRIBUTION_KEY = "eh_analytics_attribution"

interface Attribution {
  source: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
}

function getSessionId() {
  if (typeof window === "undefined") return null
  let value = window.sessionStorage.getItem(SESSION_KEY)
  if (!value) {
    value = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, value)
  }
  return value
}

function getAttribution(): Attribution {
  if (typeof window === "undefined") return { source: null, medium: null, campaign: null, referrer: null }

  const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as Attribution
    } catch {
      window.sessionStorage.removeItem(ATTRIBUTION_KEY)
    }
  }

  const params = new URLSearchParams(window.location.search)
  let referrer: string | null = null
  let referrerHost: string | null = null
  if (document.referrer) {
    try {
      const parsed = new URL(document.referrer)
      if (parsed.hostname !== window.location.hostname) {
        referrerHost = parsed.hostname
        referrer = `${parsed.origin}${parsed.pathname}`.slice(0, 500)
      }
    } catch {
      referrerHost = null
      referrer = null
    }
  }

  const source = params.get("utm_source") || referrerHost || "direct"
  const medium = params.get("utm_medium") || (referrerHost ? "referral" : "direct")
  const attribution = {
    source: source.slice(0, 120),
    medium: medium.slice(0, 120),
    campaign: params.get("utm_campaign")?.slice(0, 160) || null,
    referrer,
  }
  window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  return attribution
}

export function trackAnalyticsEvent(input: {
  eventName: ClientAnalyticsEventName
  attractionId?: string | null
  productId?: string | null
  ticketingSessionId?: string | null
  properties?: Record<string, unknown>
}) {
  if (typeof window === "undefined") return
  const attribution = getAttribution()
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      ...input,
      analyticsSessionId: getSessionId(),
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      referrer: attribution.referrer,
      path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    }),
  }).catch(() => undefined)
}
