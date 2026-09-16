import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url)
        url.search = ""
        url.hash = ""
        event.request.url = url.toString()
      } catch {
        // Keep the original URL only when it cannot be parsed.
      }
    }

    if (event.request) {
      event.request.headers = undefined
      event.request.cookies = undefined
      event.request.data = undefined
    }

    return event
  },
})
