import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
const parsedTraceRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05")
const tracesSampleRate = Number.isFinite(parsedTraceRate)
  ? Math.min(1, Math.max(0, parsedTraceRate))
  : 0.05

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate,
  beforeSend(event) {
    const requestId = event.request?.headers?.["x-request-id"]
      ?? event.request?.headers?.["x-vercel-id"]
    if (requestId) {
      event.tags = { ...event.tags, request_id: requestId.slice(0, 128) }
    }

    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
      delete event.user.username
    }

    if (event.request?.url) {
      try {
        const url = new URL(event.request.url)
        url.search = ""
        url.hash = ""
        event.request.url = `${url.origin}${url.pathname}`
      } catch {
        event.request.url = event.request.url.split("?")[0]
      }
    }

    if (event.request) {
      event.request.headers = undefined
      event.request.cookies = undefined
      event.request.data = undefined
      event.request.query_string = undefined
    }

    return event
  },
})
