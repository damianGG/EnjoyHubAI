import * as Sentry from "@sentry/nextjs"

type MonitoringContext = {
  area: string
  operation: string
  route?: string
  requestId?: string | null
  extras?: Record<string, string | number | boolean | null | undefined>
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error
  if (typeof error === "string") return new Error(error)
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return new Error(message)
  }
  return new Error("Unknown server error")
}

function cleanExtras(extras: MonitoringContext["extras"]) {
  if (!extras) return undefined

  return Object.fromEntries(
    Object.entries(extras)
      .filter(([, value]) => value !== undefined)
      .slice(0, 20),
  )
}

export function reportServerError(error: unknown, context: MonitoringContext) {
  const normalized = normalizeError(error)
  const extras = cleanExtras(context.extras)

  Sentry.withScope((scope) => {
    scope.setTag("area", context.area)
    scope.setTag("operation", context.operation)
    if (context.route) scope.setTag("route", context.route)
    if (context.requestId) scope.setTag("request_id", context.requestId)
    if (extras) scope.setExtras(extras)
    Sentry.captureException(normalized)
  })

  console.error(JSON.stringify({
    level: "error",
    message: normalized.message,
    area: context.area,
    operation: context.operation,
    route: context.route ?? null,
    requestId: context.requestId ?? null,
    ...extras,
  }))
}

export function logOperationalEvent(
  level: "info" | "warning",
  message: string,
  context: Omit<MonitoringContext, "operation"> & { operation?: string },
) {
  const payload = JSON.stringify({
    level,
    message,
    area: context.area,
    operation: context.operation ?? null,
    route: context.route ?? null,
    requestId: context.requestId ?? null,
    ...cleanExtras(context.extras),
  })

  if (level === "warning") console.warn(payload)
  else console.log(payload)
}
