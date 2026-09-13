import Link from "next/link"
import { ArrowLeft, CheckCircle2, ShieldCheck, Store } from "lucide-react"
import { notFound } from "next/navigation"

import { submitProfileClaimAction } from "@/app/przejmij-profil/[attractionId]/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ClaimProfilePage({ params, searchParams }: {
  params: Promise<{ attractionId: string }>
  searchParams: Promise<{ wyslano?: string; blad?: string }>
}) {
  const { attractionId } = await params
  const query = await searchParams
  const supabase = createClient()
  const [{ data, error }, { data: { user } }] = await Promise.all([
    supabase.rpc("profile_claim_get", { p_attraction_id: attractionId }),
    supabase.auth.getUser(),
  ])

  if (error || !data) notFound()
  const profile = data as { attractionId: string; name?: string; city?: string; organizationName?: string; claimable?: boolean; claimStatus?: string }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href={`/attractions/${attractionId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Wróć do atrakcji
        </Link>

        <Card>
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="h-5 w-5" /></div>
            <CardTitle className="text-2xl">Przejmij profil {profile.name ? `„${profile.name}”` : "atrakcji"}</CardTitle>
            <CardDescription>
              Po zatwierdzeniu przez EnjoyHub istniejący profil zostanie przypisany do Twojego konta. Nie powstanie drugi obiekt ani nowa kopia oferty.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {query.wyslano ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Wniosek został wysłany</p>
                <p className="mt-2 text-sm">Administrator EnjoyHub sprawdzi, czy reprezentujesz ten obiekt. Po akceptacji profil pojawi się w Twoim panelu organizatora.</p>
              </div>
            ) : !profile.claimable ? (
              <div className="rounded-xl border p-5">
                <p className="font-semibold">Ten profil nie jest dostępny do przejęcia.</p>
                <p className="mt-2 text-sm text-muted-foreground">Mógł już zostać przejęty przez właściciela albo nie pochodzić z bazy Supply.</p>
              </div>
            ) : !user ? (
              <div className="space-y-4 rounded-xl border p-5">
                <div>
                  <p className="font-semibold">Najpierw zaloguj się do EnjoyHub</p>
                  <p className="mt-1 text-sm text-muted-foreground">Potrzebujemy konta, do którego po weryfikacji przypiszemy firmę i profil atrakcji.</p>
                </div>
                <Button asChild className="w-full"><Link href={`/auth/login?next=${encodeURIComponent(`/przejmij-profil/${attractionId}`)}`}>Zaloguj się i kontynuuj</Link></Button>
              </div>
            ) : (
              <form action={submitProfileClaimAction.bind(null, attractionId)} className="space-y-5">
                {query.blad && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się wysłać wniosku. Profil mógł zostać już przejęty.</div>}

                <div className="rounded-xl bg-muted/60 p-4 text-sm">
                  <p className="font-medium">{profile.name}</p>
                  <p className="mt-1 text-muted-foreground">{profile.city || "Lokalizacja nieuzupełniona"}{profile.organizationName ? ` · ${profile.organizationName}` : ""}</p>
                </div>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium">Telefon kontaktowy</span>
                  <Input name="phone" type="tel" placeholder="Numer, pod którym możemy potwierdzić właściciela" />
                </label>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium">Jak możemy potwierdzić, że reprezentujesz ten obiekt?</span>
                  <Textarea name="message" rows={5} placeholder="Np. jestem właścicielem firmy; numer telefonu na stronie jest mój; mogę potwierdzić NIP lub odpowiedzieć z firmowego e-maila." />
                </label>

                <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="h-4 w-4" />Co się stanie po akceptacji?</p>
                  <p className="mt-2">Twoje konto otrzyma rolę właściciela istniejącej organizacji. Następnie będziesz mógł zarządzać ofertą, terminami i treścią profilu z panelu EnjoyHub.</p>
                </div>

                <Button type="submit" size="lg" className="w-full">Wyślij wniosek o przejęcie</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
