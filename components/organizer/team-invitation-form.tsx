"use client"

import { useActionState, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { Check, Copy, Loader2, Mail, UserPlus } from "lucide-react"

import {
  createTeamInvitation,
  type TeamInvitationActionState,
} from "@/app/host/zespol/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { organizerRoleDescriptions, organizerRoleLabels, type OrganizerRole } from "@/lib/organizer/access"

const initialState: TeamInvitationActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Tworzę zaproszenie…</> : <><UserPlus className="h-4 w-4" /> Zaproś do zespołu</>}
    </Button>
  )
}

export function TeamInvitationForm({
  organizationId,
  actorRole,
}: {
  organizationId: string
  actorRole: "owner" | "admin"
}) {
  const [state, formAction] = useActionState(createTeamInvitation, initialState)
  const [copied, setCopied] = useState(false)
  const inviteRoles = useMemo<OrganizerRole[]>(
    () => actorRole === "owner" ? ["admin", "manager", "cashier", "viewer"] : ["manager", "cashier", "viewer"],
    [actorRole],
  )
  const [role, setRole] = useState<OrganizerRole>("manager")

  const invitationUrl = state.invitationPath
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.invitationPath}`
    : ""

  async function copyInvitation() {
    if (!invitationUrl) return
    await navigator.clipboard.writeText(invitationUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="space-y-2">
          <Label htmlFor={`team-email-${organizationId}`}>E-mail pracownika</Label>
          <Input
            id={`team-email-${organizationId}`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="pracownik@firma.pl"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`team-role-${organizationId}`}>Rola</Label>
          <Select name="role" value={role} onValueChange={(value) => setRole(value as OrganizerRole)}>
            <SelectTrigger id={`team-role-${organizationId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inviteRoles.map((option) => (
                <SelectItem key={option} value={option}>{organizerRoleLabels[option]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SubmitButton />
      </form>

      <p className="text-sm text-muted-foreground">{organizerRoleDescriptions[role]}</p>

      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Nie udało się utworzyć zaproszenia</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.invitationPath ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <Mail className="h-4 w-4" />
          <AlertTitle>Zaproszenie gotowe</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Wyślij ten link do <strong>{state.email}</strong>. Link działa przez 7 dni i może go przyjąć wyłącznie konto zalogowane tym samym adresem e-mail.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={invitationUrl} readOnly className="bg-background font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyInvitation} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Skopiowano" : "Kopiuj link"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
