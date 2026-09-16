import { sendTransactionalEmail, type EmailSendResult, type TransactionalEmail } from "@/lib/email/client"
import { createAdminClient } from "@/lib/supabase/admin"

export type EmailOutboxSourceType =
  | "order_confirmation"
  | "team_invitation"
  | "demand_notification"
  | "review_invitation"
  | string

export interface QueueTransactionalEmailInput extends TransactionalEmail {
  emailType: string
  sourceType?: EmailOutboxSourceType
  sourceId?: string
  metadata?: Record<string, unknown>
  dedupeKey?: string
  maxAttempts?: number
}

export interface EmailQueueResult extends EmailSendResult {
  queued?: boolean
  outboxId?: string
  status?: "pending" | "processing" | "sent" | "failed"
  providerMessageId?: string
}

type OutboxRow = {
  id: string
  status: "pending" | "processing" | "sent" | "failed"
  email_type: string
  to_addresses: string[]
  subject: string
  html_body: string
  text_body: string
  reply_to: string | null
  tags: Array<{ name: string; value: string }> | null
  source_type: string | null
  source_id: string | null
  metadata: Record<string, unknown> | null
  provider_message_id: string | null
  attempt_count: number
  max_attempts: number
  next_attempt_at: string | null
}

type CompletionRow = {
  status: "pending" | "processing" | "sent" | "failed"
  next_attempt_at: string | null
  terminal: boolean
}

export type EmailOutboxProcessResult = {
  claimed: number
  sent: number
  retryScheduled: number
  failed: number
  messages: Array<{
    outboxId: string
    status: "pending" | "sent" | "failed"
    providerMessageId?: string
    error?: string
  }>
}

export async function queueTransactionalEmail(
  message: QueueTransactionalEmailInput,
  options: { attemptImmediately?: boolean } = {},
): Promise<EmailQueueResult> {
  try {
    const supabase = createAdminClient()
    const recipients = (Array.isArray(message.to) ? message.to : [message.to])
      .map((value) => value.trim())
      .filter(Boolean)

    const { data: outboxId, error } = await supabase.rpc("email_outbox_enqueue", {
      p_email_type: message.emailType,
      p_to_addresses: recipients,
      p_subject: message.subject,
      p_html_body: message.html,
      p_text_body: message.text,
      p_reply_to: message.replyTo?.trim() || null,
      p_tags: message.tags ?? [],
      p_source_type: message.sourceType ?? null,
      p_source_id: message.sourceId ?? null,
      p_metadata: message.metadata ?? {},
      p_dedupe_key: message.dedupeKey ?? null,
      p_max_attempts: message.maxAttempts ?? 5,
    })

    if (error || !outboxId) {
      return {
        sent: false,
        queued: false,
        reason: "provider_error",
        error: error?.message || "Could not enqueue transactional email",
      }
    }

    const { data: current } = await supabase
      .from("email_outbox")
      .select("status, provider_message_id")
      .eq("id", outboxId)
      .maybeSingle()

    if (current?.status === "sent") {
      return {
        sent: true,
        queued: true,
        outboxId,
        status: "sent",
        id: current.provider_message_id ?? undefined,
        providerMessageId: current.provider_message_id ?? undefined,
      }
    }

    if (options.attemptImmediately === false) {
      return { sent: false, queued: true, outboxId, status: (current?.status as EmailQueueResult["status"]) ?? "pending" }
    }

    const processed = await processEmailOutboxBatch({ limit: 1, outboxId })
    const item = processed.messages.find((entry) => entry.outboxId === outboxId)

    if (!item) {
      return { sent: false, queued: true, outboxId, status: (current?.status as EmailQueueResult["status"]) ?? "pending" }
    }

    return {
      sent: item.status === "sent",
      queued: true,
      outboxId,
      status: item.status,
      id: item.providerMessageId,
      providerMessageId: item.providerMessageId,
      ...(item.error ? { reason: "provider_error" as const, error: item.error } : {}),
    }
  } catch (error) {
    return {
      sent: false,
      queued: false,
      reason: "provider_error",
      error: error instanceof Error ? error.message : "Unknown outbox error",
    }
  }
}

export async function processEmailOutboxBatch(
  options: { limit?: number; outboxId?: string } = {},
): Promise<EmailOutboxProcessResult> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("email_outbox_claim_batch", {
    p_limit: Math.max(1, Math.min(options.limit ?? 25, 100)),
    p_outbox_id: options.outboxId ?? null,
  })

  if (error) throw new Error(`Could not claim email outbox: ${error.message}`)

  const rows = (data ?? []) as OutboxRow[]
  const result: EmailOutboxProcessResult = {
    claimed: rows.length,
    sent: 0,
    retryScheduled: 0,
    failed: 0,
    messages: [],
  }

  for (const row of rows) {
    const startedAt = Date.now()
    let providerResult: EmailSendResult

    try {
      providerResult = await sendTransactionalEmail({
        to: row.to_addresses,
        subject: row.subject,
        html: row.html_body,
        text: row.text_body,
        replyTo: row.reply_to ?? undefined,
        tags: Array.isArray(row.tags) ? row.tags : undefined,
      })
    } catch (error) {
      providerResult = {
        sent: false,
        reason: "provider_error",
        error: error instanceof Error ? error.message : "Unknown email provider error",
      }
    }

    const durationMs = Date.now() - startedAt
    const { data: completionData, error: completionError } = await supabase.rpc("email_outbox_complete", {
      p_outbox_id: row.id,
      p_success: providerResult.sent,
      p_provider_message_id: providerResult.id ?? null,
      p_error: providerResult.sent ? null : providerResult.error ?? providerResult.reason ?? "Unknown email provider error",
      p_duration_ms: durationMs,
    })

    if (completionError || !completionData?.[0]) {
      console.error("Email outbox completion failed", {
        outboxId: row.id,
        providerSent: providerResult.sent,
        message: completionError?.message,
      })
      result.failed += 1
      result.messages.push({
        outboxId: row.id,
        status: "failed",
        providerMessageId: providerResult.id,
        error: completionError?.message || "Could not persist email delivery result",
      })
      continue
    }

    const completion = completionData[0] as CompletionRow
    if (completion.status === "sent") result.sent += 1
    else if (completion.status === "failed") result.failed += 1
    else result.retryScheduled += 1

    try {
      await syncSourceDelivery(row, completion, providerResult)
    } catch (sourceError) {
      console.error("Email outbox source synchronization failed", {
        outboxId: row.id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        error: sourceError,
      })
    }

    result.messages.push({
      outboxId: row.id,
      status: completion.status === "processing" ? "pending" : completion.status,
      providerMessageId: providerResult.id,
      ...(providerResult.sent ? {} : { error: providerResult.error ?? providerResult.reason ?? "Email delivery failed" }),
    })
  }

  return result
}

async function syncSourceDelivery(
  row: OutboxRow,
  completion: CompletionRow,
  providerResult: EmailSendResult,
) {
  if (!row.source_type || !row.source_id) return
  const supabase = createAdminClient()

  if (row.source_type === "demand_notification") {
    if (completion.status === "sent") {
      const { error } = await supabase.rpc("marketplace_complete_demand_notification", {
        p_notification_id: row.source_id,
        p_success: true,
        p_provider_message_id: providerResult.id ?? null,
        p_error: null,
      })
      if (error) throw error
    } else if (completion.status === "failed" && completion.terminal) {
      const { error } = await supabase.rpc("marketplace_complete_demand_notification", {
        p_notification_id: row.source_id,
        p_success: false,
        p_provider_message_id: null,
        p_error: providerResult.error ?? providerResult.reason ?? "Email delivery failed after all retries",
      })
      if (error) throw error
    }
    return
  }

  if (row.source_type === "review_invitation" && completion.status === "sent") {
    const { error } = await supabase
      .from("review_invitations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: providerResult.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.source_id)
      .neq("status", "expired")

    if (error) throw error
  }
}
