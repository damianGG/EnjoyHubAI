import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, CheckCircle2, ShieldCheck, UserPlus } from "lucide-react"

import { acceptTeamInvitation } from "@/app/host/zespol/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { organizerRoleDescriptions, organizerRoleLabels, type OrganizerRole } from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface InvitationPreview {
  organization_id: string
  organization_name: string
  email: string
  role: OrganizerRole
  expires_at: string
}

export default async function TeamInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/")

  const [{ token }, query] = await Promise.all([params, searchParams])
  if (!token || token.length < 32 || token.length > 256) return <InvalidInvitation />

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/host/zespol/zaproszenie/${token}`)}`)
  }

  const { data, error } = await supabase.rpc("ticketing_get_organization_invitation", { p_token: token })
  const invitation = data?.[0] as InvitationPreview | undefined

  if (error || !invitation) {
    return (
      <InvalidInvitation
        email={user.email ?? undefined}
        message="Zaproszenie wygasło, zostało anulowane albo jest przypisane do innego adresu e-mail niż obecnie zalogowane konto."
      />
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="h-7 w-7" />
          </div>
          <Badge variant="secondary" className="mx-auto mb-2 w-fit">Zaproszenie do zespołu</Badge>
          <CardTitle className="text-2xl">Dołącz do {invitation.organization_name}</CardTitle>
          <CardDescription>
            Zaproszenie jest przypisane do konta <strong>{invitation.email}</strong> i nie może zostać użyte przez inny adres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {query.blad ? (
            <Alert variant="destructive">
              <AlertTitle>Nie udało się przyjąć zaproszenia</AlertTitle>
              <AlertDescription>Sprawdź, czy zaproszenie jest nadal aktywne i czy jesteś zalogowany właściwym adresem.</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-xl border bg-muted/20 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Twoja rola</p>
                <p className="mt-1 text-lg font-semibold">{organizerRoleLabels[invitation.role]}</p>
              </div>
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{organizerRoleDescriptions[invitation.role]}</p>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Jedno konto EnjoyHub</AlertTitle>
            <AlertDescription>
              Nie powstaje drugie konto pracownicze. Twoje obecne konto otrzyma dostęp wyłącznie do tej organizacji zgodnie z nadaną rolą.
            </AlertDescription>
          </Alert>

          <form action={acceptTeamInvitation}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" size="lg" className="w-full">Przyjmij zaproszenie i otwórz panel</Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Zaproszenie wygasa {formatExpiry(invitation.expires_at)}.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

function InvalidInvitation({ email, message }: { email?: string; message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <Building2 className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <CardTitle>Nie można użyć tego zaproszenia</CardTitle>
          <CardDescription>{message ?? "Link jest nieprawidłowy albo wygasł."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {email ? <p className="text-sm text-muted-foreground">Obecnie zalogowane konto: <strong>{email}</strong></p> : null}
          <Button asChild variant="outline"><Link href="/">Wróć do EnjoyHub</Link></Button>
        </CardContent>
      </Card>
    </main>
  )
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(new Date(value))
}
