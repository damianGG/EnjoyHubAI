import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const parsedTraceRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05")
const tracesSampleRate = Number.isFinite(parsedTraceRate)
  ? Math.min(1, Math.max(0, parsedTraceRate))
  : 0.05

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
