import { NextResponse } from "next/server"

import { processEmailOutboxBatch } from "@/lib/email/outbox"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
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
    console.error("Email outbox worker authentication failed", { message: authError.message })
    return NextResponse.json({ error: "Worker authentication unavailable" }, { status: 503 })
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processEmailOutboxBatch({ limit: 50 })
    return NextResponse.json({
      ok: result.failed === 0,
      ...result,
      finishedAt: new Date().toISOString(),
    }, { status: result.failed > 0 && result.sent === 0 && result.retryScheduled === 0 ? 503 : 200 })
  } catch (error) {
    console.error("Email outbox worker failed", { error })
    return NextResponse.json({ error: "Email outbox processing failed" }, { status: 500 })
  }
}
