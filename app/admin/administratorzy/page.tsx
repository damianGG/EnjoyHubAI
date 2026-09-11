import { ShieldCheck, UserCog } from "lucide-react"

import { upsertPlatformStaffAction } from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { platformStaffRoleLabels, requirePlatformStaff, type PlatformStaffRole } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const roles: PlatformStaffRole[] = [
  "platform_superadmin",
  "platform_support",
  "platform_content",
  "platform_finance",
]

export default async function PlatformStaffPage({ searchParams }: { searchParams?: { ok?: string; blad?: string } }) {
  const { supabase, user } = await requirePlatformStaff(["platform_superadmin"], "/admin/administratorzy")
  const { data, error } = await supabase.rpc("platform_admin_list_staff")
  const staff = (data ?? []) as any[]

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Badge variant="secondary" className="mb-3"><ShieldCheck className="mr-1 h-3 w-3" /> Bezpieczeństwo platformy</Badge>
        <h1 className="text-3xl font-bold">Administratorzy EnjoyHub</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Dostęp platformowy jest niezależny od ról w organizacjach. Dodawaj tylko istniejące konta EnjoyHub i nadawaj najmniejszy potrzebny zakres uprawnień.
        </p>
      </div>

      {searchParams?.ok && <p className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">Uprawnienia administratora zostały zapisane.</p>}
      {searchParams?.blad && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się zapisać zmiany. Nie można odebrać sobie jedynego dostępu super administratora, a wskazane konto musi istnieć.</p>}
      {error && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się pobrać listy administratorów.</p>}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Dodaj administratora</CardTitle>
          <CardDescription>Osoba musi wcześniej założyć konto EnjoyHub. Każda zmiana roli jest zapisywana w audycie.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={upsertPlatformStaffAction} className="grid gap-3 md:grid-cols-[1fr_240px_160px_auto]">
            <Input name="email" type="email" required placeholder="adres@firma.pl" />
            <select name="role" defaultValue="platform_support" className="h-10 rounded-md border bg-background px-3 text-sm">
              {roles.map((role) => <option key={role} value={role}>{platformStaffRoleLabels[role]}</option>)}
            </select>
            <select name="isActive" defaultValue="true" className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="true">Aktywny</option>
              <option value="false">Nieaktywny</option>
            </select>
            <Button type="submit">Dodaj / zapisz</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {staff.map((member) => {
          const memberRole = member.role as PlatformStaffRole
          const isSelf = member.user_id === user.id
          return (
            <Card key={member.user_id}>
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.3fr_1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{member.full_name || member.email}</p>
                    {isSelf && <Badge variant="outline">Twoje konto</Badge>}
                    <Badge variant={member.is_active ? "default" : "secondary"}>{member.is_active ? "Aktywny" : "Nieaktywny"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Dodano: {new Date(member.created_at).toLocaleString("pl-PL")}</p>
                </div>

                <div className="text-sm">
                  <p className="font-medium">{platformStaffRoleLabels[memberRole]}</p>
                  <p className="text-muted-foreground">{roleDescription(memberRole)}</p>
                </div>

                <form action={upsertPlatformStaffAction} className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <input type="hidden" name="email" value={member.email} />
                  <select name="role" defaultValue={member.role} className="h-9 rounded-md border bg-background px-2 text-sm" disabled={isSelf}>
                    {roles.map((role) => <option key={role} value={role}>{platformStaffRoleLabels[role]}</option>)}
                  </select>
                  {isSelf && <input type="hidden" name="role" value="platform_superadmin" />}
                  <select name="isActive" defaultValue={member.is_active ? "true" : "false"} className="h-9 rounded-md border bg-background px-2 text-sm" disabled={isSelf}>
                    <option value="true">Aktywny</option>
                    <option value="false">Nieaktywny</option>
                  </select>
                  {isSelf && <input type="hidden" name="isActive" value="true" />}
                  <Button type="submit" size="sm" variant="outline">Zapisz</Button>
                </form>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </main>
  )
}

function roleDescription(role: PlatformStaffRole) {
  if (role === "platform_superadmin") return "Pełny dostęp, role administratorów i operacje wysokiego ryzyka."
  if (role === "platform_support") return "Pomoc organizatorom, użytkownicy, organizacje i konfiguracja obiektów."
  if (role === "platform_content") return "Treści, kategorie, pola, obiekty i atrakcje bez dostępu finansowego."
  return "Weryfikacja, płatności i rozliczenia bez zarządzania treściami i zespołami."
}
