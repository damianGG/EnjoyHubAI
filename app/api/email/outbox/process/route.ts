import { NextResponse } from "next/server"

import { processEmailOutboxBatch } from "@/lib/email/outbox"
import { reportServerError } from "@/lib/monitoring/server"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const route = "/api/email/outbox/process"

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vercel-id")

  if (!isSupabaseAdminConfigured) {
    reportServerError(new Error("Supabase is not configured"), {
      area: "email",
      operation: "outbox_worker_configuration",
      route,
      requestId,
    })
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const token = request.headers.get("x-enjoyhub-email-token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: authorized, error: authError } = await supabase.rpc("email_outbox_verify_worker_token", {
    p_token: token,
  })

  if (authError) {
    reportServerError(authError, {
      area: "email",
      operation: "outbox_worker_authentication",
      route,
      requestId,
    })
    return NextResponse.json({ error: "Worker authentication unavailable" }, { status: 503 })
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processEmailOutboxBatch({ limit: 50 })

    if (result.failed > 0) {
      reportServerError(new Error("Email outbox batch contains failed deliveries"), {
        area: "email",
        operation: "outbox_batch_delivery",
        route,
        requestId,
        extras: {
          claimed: result.claimed,
          sent: result.sent,
          retryScheduled: result.retryScheduled,
          failed: result.failed,
        },
      })
    }

    return NextResponse.json({
      ok: result.failed === 0,
      ...result,
      finishedAt: new Date().toISOString(),
    }, { status: result.failed > 0 && result.sent === 0 && result.retryScheduled === 0 ? 503 : 200 })
  } catch (error) {
    reportServerError(error, {
      area: "email",
      operation: "outbox_worker",
      route,
      requestId,
    })
    return NextResponse.json({ error: "Email outbox processing failed" }, { status: 500 })
  }
}
