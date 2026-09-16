import * as Sentry from "@sentry/nextjs"

type MonitoringContext = {
  area: string
  operation: string
  route?: string
  requestId?: string | null
  extras?: Record<string, string | number | boolean | null | undefined>
}

type CronMonitorOptions = {
  slug: string
  schedule: string
  route: string
  maxRuntimeMinutes?: number
  checkinMarginMinutes?: number
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

export function getRequestId(request: Request) {
  const value = request.headers.get("x-request-id")?.trim()
  return value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : null
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

export async function runMonitoredCron<T extends Response>(
  options: CronMonitorOptions,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  const checkInId = Sentry.captureCheckIn(
    {
      monitorSlug: options.slug,
      status: "in_progress",
    },
    {
      schedule: { type: "crontab", value: options.schedule },
      checkinMargin: options.checkinMarginMinutes ?? 5,
      maxRuntime: options.maxRuntimeMinutes ?? 10,
      timezone: "UTC",
    },
  )

  try {
    const response = await run()
    const failed = response.status >= 500

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: options.slug,
      status: failed ? "error" : "ok",
      duration: (Date.now() - startedAt) / 1000,
    })

    if (failed) {
      Sentry.withScope((scope) => {
        scope.setTag("area", "cron")
        scope.setTag("cron", options.slug)
        scope.setTag("route", options.route)
        scope.setExtra("http_status", response.status)
        Sentry.captureMessage(`Cron ${options.slug} returned HTTP ${response.status}`, "error")
      })
    }

    return response
  } catch (error) {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: options.slug,
      status: "error",
      duration: (Date.now() - startedAt) / 1000,
    })

    reportServerError(error, {
      area: "cron",
      operation: options.slug,
      route: options.route,
    })
    throw error
  }
}
