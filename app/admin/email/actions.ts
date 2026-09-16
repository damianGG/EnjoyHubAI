"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { processEmailOutboxBatch } from "@/lib/email/outbox"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { createAdminClient } from "@/lib/supabase/admin"

export async function resendEmailAction(formData: FormData) {
  const parsed = z.object({ outboxId: z.string().uuid() }).safeParse({
    outboxId: String(formData.get("outboxId") ?? ""),
  })

  if (!parsed.success) redirect("/admin/email?blad=dane")

  const { user } = await requirePlatformStaff(
    ["platform_superadmin", "platform_support"],
    "/admin/email",
  )
  const admin = createAdminClient()
  const { data: newOutboxId, error } = await admin.rpc("email_outbox_admin_resend", {
    p_actor_user_id: user.id,
    p_outbox_id: parsed.data.outboxId,
  })

  if (error || !newOutboxId) {
    console.error("Manual email resend could not be queued", {
      outboxId: parsed.data.outboxId,
      message: error?.message,
    })
    redirect("/admin/email?blad=kolejka")
  }

  let sentImmediately = false
  try {
    const result = await processEmailOutboxBatch({ limit: 1, outboxId: newOutboxId })
    sentImmediately = result.sent > 0
  } catch (processError) {
    console.error("Manual email resend remains queued after immediate attempt failed", {
      outboxId: newOutboxId,
      error: processError,
    })
  }

  revalidatePath("/admin/email")
  redirect(`/admin/email?ponowiono=1${sentImmediately ? "&wyslano=1" : ""}`)
}
