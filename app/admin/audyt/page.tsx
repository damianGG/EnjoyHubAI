import Link from "next/link"
import { ClipboardList } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

export default async function AdminAuditPage({ searchParams }: { searchParams?: { organizationId?: string } }) {
  const organizationId = searchParams?.organizationId ?? null
  const { supabase } = await requirePlatformStaff([
    "platform_superadmin",
    "platform_support",
    "platform_finance",
  ], "/admin/audyt")

  const { data, error } = await supabase.rpc("platform_admin_list_audit", {
    p_organization_id: organizationId,
    p_limit: 250,
  })
  const entries = (data ?? []) as any[]

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <Badge variant="secondary" className="mb-3"><ClipboardList className="mr-1 h-3 w-3" /> Audyt</Badge>
        <h1 className="text-3xl font-bold">Dziennik działań administratorów</h1>
        <p className="mt-2 text-muted-foreground">Kto, kiedy i co zmienił w platformie. Wpisy nie są edytowane z panelu.</p>
        {organizationId && <Link href="/admin/audyt" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Pokaż wszystkie organizacje</Link>}
      </div>

      {error && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się pobrać audytu.</p>}

      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.audit_id}>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[220px_1fr_240px] lg:items-start">
              <div className="text-sm">
                <p className="font-medium">{new Date(entry.created_at).toLocaleString("pl-PL")}</p>
                <p className="mt-1 text-muted-foreground">{entry.actor_email}</p>
                <Badge variant="outline" className="mt-2">{entry.actor_role}</Badge>
              </div>
              <div>
                <p className="font-semibold">{entry.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">{entry.entity_type}{entry.entity_id ? ` · ${entry.entity_id}` : ""}</p>
                {(Object.keys(entry.before_data ?? {}).length > 0 || Object.keys(entry.after_data ?? {}).length > 0) && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-medium text-primary">Pokaż zmianę</summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(entry.before_data ?? {}, null, 2)}</pre>
                      <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(entry.after_data ?? {}, null, 2)}</pre>
                    </div>
                  </details>
                )}
              </div>
              <div className="text-sm lg:text-right">
                {entry.organization_id ? <Link href={`/admin/organizacje/${entry.organization_id}`} className="font-medium text-primary hover:underline">Otwórz organizację</Link> : <span className="text-muted-foreground">Zmiana platformowa</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {!error && entries.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">Brak wpisów audytowych.</CardContent></Card>}
      </div>
    </main>
  )
}
