import { NextResponse } from "next/server"

import { getRequestId, reportServerError } from "@/lib/monitoring/server"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"

  if (!isSupabaseAdminConfigured) {
    return response({
      ok: false,
      environment,
      release,
      checks: { app: true, database: false },
    }, 503, requestId)
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .limit(1)

    if (error) throw error

    return response({
      ok: true,
      environment,
      release,
      checks: { app: true, database: true },
    }, 200, requestId)
  } catch (error) {
    reportServerError(error, {
      area: "health",
      operation: "database_check",
      route: "/api/health",
      requestId,
    })

    return response({
      ok: false,
      environment,
      release,
      checks: { app: true, database: false },
    }, 503, requestId)
  }
}

function response(
  body: Record<string, unknown>,
  status: number,
  requestId: string | null,
) {
  const headers = new Headers({
    "cache-control": "no-store",
  })
  if (requestId) headers.set("x-request-id", requestId)
  return NextResponse.json(body, { status, headers })
}
