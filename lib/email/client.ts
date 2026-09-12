const RESEND_ENDPOINT = "https://api.resend.com/emails"

export interface TransactionalEmail {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  tags?: Array<{ name: string; value: string }>
}

export interface EmailSendResult {
  sent: boolean
  id?: string
  reason?: "not_configured" | "provider_error"
  error?: string
}

export function isTransactionalEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendTransactionalEmail(message: TransactionalEmail): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      sent: false,
      reason: "not_configured",
      error: "RESEND_API_KEY is not configured",
    }
  }

  const from = process.env.EMAIL_FROM?.trim() || "EnjoyHub <hello@enjoyhub.app>"
  const replyTo = message.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim() || undefined

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(message.tags?.length ? { tags: message.tags } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null
    if (!response.ok) {
      return {
        sent: false,
        reason: "provider_error",
        error: payload?.message || `Resend returned HTTP ${response.status}`,
      }
    }

    return { sent: true, id: payload?.id }
  } catch (error) {
    return {
      sent: false,
      reason: "provider_error",
      error: error instanceof Error ? error.message : "Unknown email provider error",
    }
  } finally {
    clearTimeout(timeout)
  }
}
