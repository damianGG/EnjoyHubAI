import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, KeyRound, ShieldCheck, Trash2, UserRound, Users } from "lucide-react"

import {
  removeTeamMember,
  revokeTeamInvitation,
  updateTeamMemberRole,
} from "@/app/host/zespol/actions"
import { TeamInvitationForm } from "@/components/organizer/team-invitation-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  organizerRoleDescriptions,
  organizerRoleLabels,
  organizerTeamRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface TeamMembership {
  organization_id: string
  role: OrganizerRole
}

interface TeamOrganization {
  id: string
  name: string
}

interface TeamMember {
  member_user_id: string
  full_name: string
  email: string
  role: OrganizerRole
  joined_at: string
  is_current_user: boolean
}

interface PendingInvitation {
  invitation_id: string
  email: string
  role: OrganizerRole
  expires_at: string
  created_at: string
}

interface OrganizationTeamData {
  organization: TeamOrganization
  actorRole: "owner" | "admin"
  members: TeamMember[]
  invitations: PendingInvitation[]
}

export default async function OrganizerTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const [query, supabase] = await Promise.all([searchParams, Promise.resolve(createClient())])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/zespol")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", [...organizerTeamRoles])

  if (membershipError) return <CenteredMessage>Nie udało się sprawdzić uprawnień do zespołu.</CenteredMessage>

  const memberships = (membershipData ?? []) as TeamMembership[]
  if (memberships.length === 0) {
    return <CenteredMessage>Zespołem mogą zarządzać tylko właściciel i administrator organizacji.</CenteredMessage>
  }

  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id))]
  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds)
    .order("name")

  if (organizationError) return <CenteredMessage>Nie udało się pobrać organizacji.</CenteredMessage>

  const organizations = (organizationData ?? []) as TeamOrganization[]
  const membershipByOrganization = new Map(memberships.map((membership) => [membership.organization_id, membership.role]))

  const teams = await Promise.all(
    organizations.map(async (organization): Promise<OrganizationTeamData | null> => {
      const actorRole = membershipByOrganization.get(organization.id)
      if (actorRole !== "owner" && actorRole !== "admin") return null

      const [membersResult, invitationsResult] = await Promise.all([
        supabase.rpc("ticketing_list_organization_team", { p_organization_id: organization.id }),
        supabase.rpc("ticketing_list_organization_invitations", { p_organization_id: organization.id }),
      ])

      if (membersResult.error || invitationsResult.error) return null
      return {
        organization,
        actorRole,
        members: (membersResult.data ?? []) as TeamMember[],
        invitations: (invitationsResult.data ?? []) as PendingInvitation[],
      }
    }),
  )

  const availableTeams = teams.filter((team): team is OrganizationTeamData => Boolean(team))
  if (availableTeams.length === 0) return <CenteredMessage>Nie udało się załadować zespołu.</CenteredMessage>

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/95">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Powrót do pulpitu
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="mb-8 max-w-3xl">
          <Badge variant="secondary" className="mb-3">Zespół i uprawnienia</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Każdy widzi tylko to, czego potrzebuje</h1>
          <p className="mt-3 text-muted-foreground">
            Zapraszaj pracowników do konkretnej organizacji i nadawaj im rolę. Konto pracownika pozostaje zwykłym kontem EnjoyHub — uprawnienia działają tylko wewnątrz Twojej organizacji.
          </p>
        </div>

        {query.ok ? (
          <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Zmiana zapisana</AlertTitle>
            <AlertDescription>
              {query.ok === "rola" ? "Uprawnienia członka zespołu zostały zaktualizowane." : query.ok === "usunieto" ? "Osoba została usunięta z organizacji." : "Zaproszenie zostało anulowane."}
            </AlertDescription>
          </Alert>
        ) : null}

        {query.blad ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Nie udało się zapisać zmiany</AlertTitle>
            <AlertDescription>
              {query.blad === "wlasciciel"
                ? "Organizacja musi zawsze mieć co najmniej jednego właściciela. Najpierw nadaj rolę właściciela drugiej osobie."
                : "Sprawdź swoje uprawnienia i spróbuj ponownie."}
            </AlertDescription>
          </Alert>
        ) : null}

        <RoleLegend />

        <div className="mt-8 space-y-8">
          {availableTeams.map((team) => (
            <OrganizationTeam key={team.organization.id} team={team} />
          ))}
        </div>
      </div>
    </main>
  )
}

function OrganizationTeam({ team }: { team: OrganizationTeamData }) {
  const ownerCount = team.members.filter((member) => member.role === "owner").length

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{team.organization.name}</h2>
          <p className="text-sm text-muted-foreground">{team.members.length} {team.members.length === 1 ? "osoba" : "osoby"} w zespole · Twoja rola: {organizerRoleLabels[team.actorRole]}</p>
        </div>
        <Badge variant="outline">{team.actorRole === "owner" ? "Możesz zarządzać wszystkimi rolami" : "Nie możesz zarządzać właścicielami i administratorami"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Członkowie zespołu</CardTitle>
          <CardDescription>Zmiana roli działa natychmiast przy następnym wejściu do panelu.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {team.members.map((member) => {
            const protectedFromAdmin = team.actorRole === "admin" && (member.role === "owner" || member.role === "admin")
            const isLastOwnerSelf = member.is_current_user && member.role === "owner" && ownerCount === 1
            const canEdit = !protectedFromAdmin && !isLastOwnerSelf
            const roles = team.actorRole === "owner"
              ? (["owner", "admin", "manager", "cashier", "viewer"] as OrganizerRole[])
              : (["manager", "cashier", "viewer"] as OrganizerRole[])

            return (
              <div key={member.member_user_id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_17rem_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{member.full_name || member.email}</p>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>{organizerRoleLabels[member.role]}</Badge>
                    {member.is_current_user ? <Badge variant="outline">Ty</Badge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{organizerRoleDescriptions[member.role]}</p>
                </div>

                {canEdit ? (
                  <form action={updateTeamMemberRole} className="flex gap-2">
                    <input type="hidden" name="organizationId" value={team.organization.id} />
                    <input type="hidden" name="userId" value={member.member_user_id} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {roles.map((role) => <option key={role} value={role}>{organizerRoleLabels[role]}</option>)}
                    </select>
                    <Button type="submit" variant="outline" size="sm" className="h-10">Zapisz</Button>
                  </form>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {isLastOwnerSelf ? "Najpierw dodaj drugiego właściciela" : "Rola chroniona"}
                  </div>
                )}

                {canEdit && !member.is_current_user ? (
                  <form action={removeTeamMember}>
                    <input type="hidden" name="organizationId" value={team.organization.id} />
                    <input type="hidden" name="userId" value={member.member_user_id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" /> Usuń
                    </Button>
                  </form>
                ) : <div />}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> Zaproś pracownika</CardTitle>
          <CardDescription>Tworzysz bezpieczne zaproszenie ważne przez 7 dni. EnjoyHub wysyła je automatycznie e-mailem, a link możesz też skopiować ręcznie.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamInvitationForm organizationId={team.organization.id} actorRole={team.actorRole} />
        </CardContent>
      </Card>

      {team.invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Oczekujące zaproszenia</CardTitle>
            <CardDescription>Zaproszenie nie daje dostępu, dopóki osoba nie zaloguje się właściwym adresem e-mail i go nie zaakceptuje.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {team.invitations.map((invitation) => (
              <div key={invitation.invitation_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{invitation.email}</p>
                    <Badge variant="secondary">{organizerRoleLabels[invitation.role]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Wygasa {formatExpiry(invitation.expires_at)}</p>
                </div>
                <form action={revokeTeamInvitation}>
                  <input type="hidden" name="invitationId" value={invitation.invitation_id} />
                  <Button type="submit" variant="outline" size="sm">Anuluj zaproszenie</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

function RoleLegend() {
  const roles: OrganizerRole[] = ["owner", "admin", "manager", "cashier", "viewer"]
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Podział ról</CardTitle>
        <CardDescription>Role są celowo wąskie — szczególnie dane prawne firmy i zarządzanie ludźmi.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {roles.map((role) => (
          <div key={role} className="rounded-lg border bg-background p-4">
            <Badge variant={role === "owner" ? "default" : "secondary"}>{organizerRoleLabels[role]}</Badge>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{organizerRoleDescriptions[role]}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(new Date(value))
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="max-w-xl">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">{children}</p>
          <Button asChild variant="outline" className="mt-5"><Link href="/host">Wróć do pulpitu</Link></Button>
        </CardContent>
      </Card>
    </main>
  )
}
