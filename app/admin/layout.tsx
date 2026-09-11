import Link from "next/link"
import { Building2, ClipboardList, FolderTree, ListTree, Shield, ShieldCheck, Users } from "lucide-react"

import { clearSupportContextAction } from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { platformStaffRoleLabels, requirePlatformStaff } from "@/lib/platform-admin/access"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, role } = await requirePlatformStaff(undefined, "/admin")
  const { data: supportContext } = await supabase
    .from("platform_support_context")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle()

  let supportName: string | null = null
  if (supportContext?.organization_id) {
    const { data } = await supabase.rpc("platform_admin_get_organization", {
      p_organization_id: supportContext.organization_id,
    })
    supportName = (data as { organization?: { name?: string } } | null)?.organization?.name ?? null
  }

  const canSupport = role === "platform_superadmin" || role === "platform_support"
  const canAudit = canSupport || role === "platform_finance"
  const canContent = role === "platform_superadmin" || role === "platform_content"

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex min-h-16 flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Shield className="h-5 w-5 text-primary" />
            EnjoyHub Admin
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <AdminNav href="/admin/organizacje" icon={Building2}>Organizacje</AdminNav>
            {canSupport && <AdminNav href="/admin/uzytkownicy" icon={Users}>Użytkownicy</AdminNav>}
            {canAudit && <AdminNav href="/admin/audyt" icon={ClipboardList}>Audyt</AdminNav>}
            {canContent && <AdminNav href="/admin/categories" icon={FolderTree}>Kategorie</AdminNav>}
            {canContent && <AdminNav href="/admin/fields" icon={ListTree}>Pola</AdminNav>}
            {role === "platform_superadmin" && <AdminNav href="/admin/administratorzy" icon={ShieldCheck}>Administratorzy</AdminNav>}
          </nav>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{platformStaffRoleLabels[role]}</Badge>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard">Konto</Link></Button>
          </div>
        </div>
      </header>

      {supportContext?.organization_id && (
        <div className="border-b border-amber-300 bg-amber-50 text-amber-950">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
            <div>
              <strong>Tryb wsparcia:</strong> {supportName ?? "wybrana organizacja"}
              <span className="ml-2 text-amber-800">Działasz jako administrator EnjoyHub — wszystkie zmiany są logowane.</span>
            </div>
            {canSupport && (
              <form action={clearSupportContextAction}>
                <Button type="submit" variant="outline" size="sm" className="border-amber-400 bg-white">Zakończ wsparcie</Button>
              </form>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

function AdminNav({ href, icon: Icon, children }: { href: string; icon: typeof Shield; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
      <Icon className="h-4 w-4" /> {children}
    </Link>
  )
}
