import { NextResponse } from "next/server"

import { sendReviewInvitationEmail } from "@/lib/email/review-invitation"
import { getRequestId, reportServerError, runMonitoredCron } from "@/lib/monitoring/server"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const route = "/api/cron/review-invitations"

type ReviewInvitationDelivery = {
  invitation_id: string
  invitation_token: string
  recipient_email: string
  recipient_name: string | null
  property_id: string
  property_title: string
  used_at: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const requestId = getRequestId(request) ?? request.headers.get("x-vercel-id")

  return runMonitoredCron({
    slug: "enjoyhub-review-invitations",
    schedule: "0 8 * * *",
    route,
    maxRuntimeMinutes: 10,
    checkinMarginMinutes: 10,
  }, async () => {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("review_prepare_invitations")
    if (error) {
      reportServerError(error, {
        area: "reviews",
        operation: "prepare_review_invitations",
        route,
        requestId,
        extras: { errorCode: error.code },
      })
      return NextResponse.json({ error: "Review invitation preparation failed" }, { status: 500 })
    }

    const invitations = (data ?? []) as ReviewInvitationDelivery[]
    let queued = 0
    let sent = 0
    let failed = 0

    for (const invitation of invitations) {
      const result = await sendReviewInvitationEmail({
        invitationId: invitation.invitation_id,
        token: invitation.invitation_token,
        recipientEmail: invitation.recipient_email,
        recipientName: invitation.recipient_name,
        propertyId: invitation.property_id,
        propertyTitle: invitation.property_title,
      })

      if (result.sent) {
        sent += 1
        const { error: updateError } = await supabase
          .from("review_invitations")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.providerMessageId ?? result.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.invitation_id)
          .neq("status", "expired")

        if (updateError) {
          failed += 1
          reportServerError(updateError, {
            area: "reviews",
            operation: "repair_review_invitation_state",
            route,
            requestId,
            extras: { invitationId: invitation.invitation_id },
          })
        }
        continue
      }

      if (result.queued && result.status !== "failed") {
        queued += 1
        continue
      }

      failed += 1
      reportServerError(new Error(result.error ?? result.reason ?? "Review invitation could not be queued"), {
        area: "reviews",
        operation: "queue_review_invitation",
        route,
        requestId,
        extras: {
          invitationId: invitation.invitation_id,
          propertyId: invitation.property_id,
          outboxId: result.outboxId ?? null,
        },
      })
    }

    return NextResponse.json({
      ok: failed === 0,
      prepared: invitations.length,
      queued,
      sent,
      failed,
      finishedAt: new Date().toISOString(),
    }, { status: failed > 0 && queued === 0 && sent === 0 ? 503 : 200 })
  })
}
