"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { sendTransactionalEmail } from "@/lib/email/client"
import { getEmailSiteUrl } from "@/lib/email/site-url"
import { renderTeamInvitationEmail } from "@/lib/email/templates"
import { organizerRoleLabels, type OrganizerRole } from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

const editableRoles = ["owner", "admin", "manager", "cashier", "viewer"] as const
const inviteRoles = ["admin", "manager", "cashier", "viewer"] as const

export interface TeamInvitationActionState {
  error?: string
  invitationPath?: string
  email?: string
  expiresAt?: string
  emailSent?: boolean
  emailWarning?: string
}

function teamError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? ""
  if (message.includes("already belongs")) return "Ta osoba jest już w zespole."
  if (message.includes("active invitation")) return "Dla tego adresu istnieje już aktywne zaproszenie."
  if (message.includes("last owner") || message.includes("at least one owner")) return "Organizacja musi mieć co najmniej jednego właściciela. Najpierw nadaj rolę właściciela innej osobie."
  if (message.includes("Only an owner")) return "Tę operację może wykonać tylko właściciel organizacji."
  if (message.includes("email")) return "Podaj poprawny adres e-mail."
  if (error?.code === "42501") return "Nie masz uprawnień do wykonania tej operacji."
  if (error?.code === "P0002") return "Zaproszenie lub członek zespołu nie istnieje albo wygasł."
  return "Nie udało się zapisać zmiany. Spróbuj ponownie."
}

async function authenticatedClient(next = "/host/zespol") {
  if (!isSupabaseConfigured) redirect("/host")
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`)
  return { supabase, user }
}

export async function createTeamInvitation(
  _previousState: TeamInvitationActionState,
  formData: FormData,
): Promise<TeamInvitationActionState> {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    email: z.string().trim().email().max(320),
    role: z.enum(inviteRoles),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  })

  if (!parsed.success) return { error: "Sprawdź adres e-mail i wybraną rolę." }

  const { supabase } = await authenticatedClient()
  const { data, error } = await supabase.rpc("ticketing_create_organization_invitation", {
    p_organization_id: parsed.data.organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  })

  if (error) return { error: teamError(error) }

  const invitation = data?.[0] as { invitation_token?: string; expires_at?: string } | undefined
  if (!invitation?.invitation_token) return { error: "Zaproszenie zostało zapisane, ale nie udało się utworzyć linku." }

  const invitationPath = `/host/zespol/zaproszenie/${invitation.invitation_token}`
  let emailSent = false
  let emailWarning: string | undefined

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", parsed.data.organizationId)
    .maybeSingle()

  if (organization?.name && invitation.expires_at) {
    const rendered = renderTeamInvitationEmail({
      organizationName: organization.name,
      roleLabel: organizerRoleLabels[parsed.data.role],
      inviteUrl: `${getEmailSiteUrl()}${invitationPath}`,
      expiresAt: invitation.expires_at,
    })
    const result = await sendTransactionalEmail({
      to: parsed.data.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [{ name: "type", value: "team-invitation" }],
    })
    emailSent = result.sent
    if (!result.sent) {
      emailWarning = result.reason === "not_configured"
        ? "Zaproszenie jest ważne, ale automatyczna wysyłka e-mail nie jest jeszcze skonfigurowana. Skopiuj link poniżej."
        : "Zaproszenie jest ważne, ale wiadomości nie udało się teraz dostarczyć. Skopiuj link poniżej."
      console.error("Team invitation email failed", { reason: result.reason, error: result.error })
    }
  } else {
    emailWarning = "Zaproszenie jest ważne, ale nie udało się przygotować wiadomości e-mail. Skopiuj link poniżej."
  }

  revalidatePath("/host/zespol")
  return {
    invitationPath,
    email: parsed.data.email,
    expiresAt: invitation.expires_at,
    emailSent,
    emailWarning,
  }
}

export async function updateTeamMemberRole(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(editableRoles),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    userId: String(formData.get("userId") ?? ""),
    role: String(formData.get("role") ?? ""),
  })

  if (!parsed.success) redirect("/host/zespol?blad=dane")
  const { supabase } = await authenticatedClient()
  const { error } = await supabase.rpc("ticketing_update_organization_member_role", {
    p_organization_id: parsed.data.organizationId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  })

  if (error) {
    console.error("Team role update failed", { code: error.code, message: error.message })
    redirect(`/host/zespol?blad=${error.code === "P0001" ? "wlasciciel" : "uprawnienia"}`)
  }

  revalidatePath("/host/zespol")
  revalidatePath("/host")
  redirect("/host/zespol?ok=rola")
}

export async function removeTeamMember(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
  }).safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    userId: String(formData.get("userId") ?? ""),
  })

  if (!parsed.success) redirect("/host/zespol?blad=dane")
  const { supabase } = await authenticatedClient()
  const { error } = await supabase.rpc("ticketing_remove_organization_member", {
    p_organization_id: parsed.data.organizationId,
    p_user_id: parsed.data.userId,
  })

  if (error) {
    console.error("Team member removal failed", { code: error.code, message: error.message })
    redirect(`/host/zespol?blad=${error.code === "P0001" ? "wlasciciel" : "uprawnienia"}`)
  }

  revalidatePath("/host/zespol")
  revalidatePath("/host")
  redirect("/host/zespol?ok=usunieto")
}

export async function revokeTeamInvitation(formData: FormData) {
  const parsed = z.object({ invitationId: z.string().uuid() }).safeParse({
    invitationId: String(formData.get("invitationId") ?? ""),
  })
  if (!parsed.success) redirect("/host/zespol?blad=dane")

  const { supabase } = await authenticatedClient()
  const { error } = await supabase.rpc("ticketing_revoke_organization_invitation", {
    p_invitation_id: parsed.data.invitationId,
  })

  if (error) {
    console.error("Team invitation revoke failed", { code: error.code, message: error.message })
    redirect("/host/zespol?blad=uprawnienia")
  }

  revalidatePath("/host/zespol")
  redirect("/host/zespol?ok=anulowano")
}

export async function acceptTeamInvitation(formData: FormData) {
  const parsed = z.object({ token: z.string().min(32).max(256) }).safeParse({
    token: String(formData.get("token") ?? ""),
  })
  if (!parsed.success) redirect("/host?blad=zaproszenie")

  const next = `/host/zespol/zaproszenie/${parsed.data.token}`
  const { supabase } = await authenticatedClient(next)
  const { error } = await supabase.rpc("ticketing_accept_organization_invitation", {
    p_token: parsed.data.token,
  })

  if (error) {
    console.error("Team invitation acceptance failed", { code: error.code, message: error.message })
    redirect(`${next}?blad=1`)
  }

  revalidatePath("/host")
  revalidatePath("/host/zespol")
  redirect("/host?dolaczono=1")
}

export type { OrganizerRole }
