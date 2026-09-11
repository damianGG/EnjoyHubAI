import Link from "next/link"
import { Search, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = searchParams?.q?.trim() ?? ""
  const { supabase } = await requirePlatformStaff(["platform_superadmin", "platform_support"], "/admin/uzytkownicy")
  const { data, error } = await supabase.rpc("platform_admin_list_users", { p_search: q || null, p_limit: 250 })
  const users = (data ?? []) as any[]

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3"><Users className="mr-1 h-3 w-3" /> Użytkownicy</Badge>
          <h1 className="text-3xl font-bold">Konta EnjoyHub</h1>
          <p className="mt-2 text-muted-foreground">Wyszukaj użytkownika i sprawdź, do których organizacji jest przypisany.</p>
        </div>
        <form className="flex w-full max-w-md gap-2" action="/admin/uzytkownicy">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={q} placeholder="E-mail lub imię i nazwisko…" className="pl-9" /></div>
          <Button type="submit" variant="outline">Szukaj</Button>
        </form>
      </div>

      {error && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się pobrać użytkowników.</p>}

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.user_id}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{user.full_name || user.email || "Użytkownik"}</p>
                  {user.platform_role && <Badge>{user.platform_role}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">Konto od {new Date(user.created_at).toLocaleDateString("pl-PL")}</p>
              </div>
              <div className="space-y-2">
                {(user.memberships ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Brak członkostwa w organizacjach.</p> : (user.memberships ?? []).map((membership: any) => (
                  <Link key={`${user.user_id}-${membership.organizationId}`} href={`/admin/organizacje/${membership.organizationId}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/40">
                    <span>{membership.organizationName}</span><Badge variant="outline">{membership.role}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {!error && users.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">Brak użytkowników pasujących do wyszukiwania.</CardContent></Card>}
      </div>
    </main>
  )
}
