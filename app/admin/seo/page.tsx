import Link from "next/link"
import { CheckCircle2, CircleAlert, Gauge, RefreshCw, ShieldOff } from "lucide-react"

import { setSeoExcludedAction, submitSeoSnapshotToIndexNowAction } from "@/app/admin/seo/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { SEO_LOCAL_THRESHOLDS, getSeoQualityDashboard } from "@/lib/seo/quality"

export const dynamic = "force-dynamic"

const seoRoles = ["platform_superadmin", "platform_content"] as const

export default async function AdminSeoPage({
  searchParams,
}: {
  searchParams: Promise<{ indexnow?: string; wyslano?: string; blad?: string }>
}) {
  await requirePlatformStaff(seoRoles, "/admin/seo")
  const [dashboard, query] = await Promise.all([getSeoQualityDashboard(), searchParams])

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3"><Gauge className="mr-1 h-3.5 w-3.5" />SEO quality</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Kontrola jakości SEO</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Jedno miejsce do kontroli kompletności profili, gotowości miast i kategorii do indeksacji oraz zgłaszania aktualnych URL-i do IndexNow.
          </p>
        </div>
        <form action={submitSeoSnapshotToIndexNowAction}>
          <Button type="submit" variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Wyślij aktualne URL-e do IndexNow</Button>
        </form>
      </div>

      {query.indexnow && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${query.indexnow === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          IndexNow: {query.indexnow === "ok" ? "zgłoszenie przyjęte" : "część zgłoszeń wymaga ponowienia"}. URL-e w paczce: {Number(query.wyslano || 0)}.
        </div>
      )}
      {query.blad && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Nie udało się zapisać zmiany SEO.</div>}

      <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Aktywne profile" value={dashboard.totalActive} />
        <Metric label="Gotowe jakościowo" value={dashboard.eligibleProfiles} />
        <Metric label="Średni wynik" value={`${dashboard.averageScore}%`} />
        <Metric label="Miasta index" value={dashboard.indexableCities} />
        <Metric label="Kategorie index" value={dashboard.indexableCategories} />
        <Metric label="Wyłączone ręcznie" value={dashboard.excludedProfiles} />
      </section>

      <Card className="mb-7">
        <CardHeader>
          <CardTitle>Gotowość lokalnych landingów</CardTitle>
          <CardDescription>
            Miasto wchodzi do indeksu od {SEO_LOCAL_THRESHOLDS.city} kompletnych profili, a miasto × kategoria od {SEO_LOCAL_THRESHOLDS.cityCategory} kompletnych profili w tej kategorii.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="py-2 pr-4">Miasto</th><th>Aktywne</th><th>SEO-ready</th><th>Status miasta</th><th>Kategorie gotowe</th><th>Landing</th></tr></thead>
            <tbody className="divide-y">
              {dashboard.cities.map((city) => (
                <tr key={city.slug}>
                  <td className="py-3 pr-4 font-medium">{city.name}</td>
                  <td>{city.activeCount}</td>
                  <td>{city.seoEligibleCount}/{city.threshold}</td>
                  <td>{city.indexable ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />index</Badge> : <Badge variant="outline" className="gap-1"><CircleAlert className="h-3 w-3" />noindex</Badge>}</td>
                  <td>{city.indexableCategoryCount}/{city.categoryCount}</td>
                  <td><Link href={`/atrakcje/${city.slug}`} target="_blank" className="font-medium text-primary hover:underline">Podgląd</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {dashboard.cities.length === 0 && <p className="py-6 text-sm text-muted-foreground">Brak aktywnych miast do analizy.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile atrakcji</CardTitle>
          <CardDescription>
            Wynik jest liczony z sześciu kryteriów zgodnych z quality gate: tytuł, opis, adres, kategoria, zdjęcie i GPS. `seo_excluded` jest osobnym ręcznym bezpiecznikiem.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="py-2 pr-4">Wynik</th><th className="pr-4">Atrakcja</th><th className="pr-4">Miasto</th><th className="pr-4">Braki</th><th className="pr-4">SEO</th><th className="pr-4">Profil</th><th>Akcja</th></tr></thead>
            <tbody className="divide-y">
              {dashboard.profiles.slice(0, 300).map((profile) => (
                <tr key={profile.id}>
                  <td className="py-3 pr-4"><Badge variant={profile.score === 100 ? "default" : profile.score >= 67 ? "secondary" : "outline"}>{profile.score}%</Badge></td>
                  <td className="max-w-[260px] py-3 pr-4 font-medium">{profile.title}</td>
                  <td className="pr-4">{profile.city}</td>
                  <td className="max-w-[360px] pr-4 text-xs text-muted-foreground">{profile.missingLabels.length ? profile.missingLabels.join(" · ") : "Kompletny profil"}</td>
                  <td className="pr-4">
                    {profile.seoExcluded
                      ? <Badge variant="outline" className="gap-1"><ShieldOff className="h-3 w-3" />wyłączony</Badge>
                      : profile.seoEligible
                        ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />gotowy</Badge>
                        : <Badge variant="secondary">do poprawy</Badge>}
                  </td>
                  <td className="pr-4"><Link href={profile.canonicalPath} target="_blank" className="font-medium text-primary hover:underline">Otwórz</Link></td>
                  <td>
                    <form action={setSeoExcludedAction.bind(null, profile.id, !profile.seoExcluded)}>
                      <Button type="submit" size="sm" variant={profile.seoExcluded ? "outline" : "ghost"}>{profile.seoExcluded ? "Włącz SEO" : "Wyłącz SEO"}</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dashboard.profiles.length > 300 && <p className="pt-4 text-xs text-muted-foreground">Pokazuję 300 profili o najniższej gotowości. Podsumowania obejmują wszystkie aktywne profile.</p>}
          {dashboard.profiles.length === 0 && <p className="py-6 text-sm text-muted-foreground">Brak aktywnych atrakcji.</p>}
        </CardContent>
      </Card>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></CardContent></Card>
}
