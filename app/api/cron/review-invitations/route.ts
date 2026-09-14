import { NextResponse } from "next/server"

import { sendReviewInvitationEmail } from "@/lib/email/review-invitation"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

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

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("review_prepare_invitations")
  if (error) {
    console.error("Review invitation preparation failed", {
      code: error.code,
      message: error.message,
    })
    return NextResponse.json({ error: "Review invitation preparation failed" }, { status: 500 })
  }

  const invitations = (data ?? []) as ReviewInvitationDelivery[]
  let sent = 0
  let failed = 0

  for (const invitation of invitations) {
    const result = await sendReviewInvitationEmail({
      token: invitation.invitation_token,
      recipientEmail: invitation.recipient_email,
      recipientName: invitation.recipient_name,
      propertyTitle: invitation.property_title,
    })

    if (!result.sent) {
      failed += 1
      console.error("Review invitation email failed", {
        invitationId: invitation.invitation_id,
        reason: result.reason,
        error: result.error,
      })
      continue
    }

    const { error: updateError } = await supabase
      .from("review_invitations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.invitation_id)
      .eq("status", "pending")

    if (updateError) {
      failed += 1
      console.error("Review invitation delivery state update failed", {
        invitationId: invitation.invitation_id,
        message: updateError.message,
      })
      continue
    }

    sent += 1
  }

  return NextResponse.json({
    ok: failed === 0,
    prepared: invitations.length,
    sent,
    failed,
    finishedAt: new Date().toISOString(),
  }, { status: failed > 0 && sent === 0 ? 503 : 200 })
}
