import Link from "next/link"
import { CheckCircle2, MapPin, ShieldCheck, Star } from "lucide-react"

import { submitVerifiedReviewAction } from "@/app/opinia/[token]/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface ReviewInvitationContext {
  valid?: boolean
  eligible?: boolean
  completed?: boolean
  propertyId?: string
  propertyTitle?: string
  propertyCity?: string
  recipientName?: string | null
}

export default async function VerifiedReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ dziekujemy?: string; blad?: string }>
}) {
  const [{ token }, query] = await Promise.all([params, searchParams])

  if (!isSupabaseConfigured) {
    return <ReviewMessage title="Opinie są chwilowo niedostępne">Spróbuj ponownie później.</ReviewMessage>
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("review_invitation_get", { p_token: token })
  if (error) {
    return <ReviewMessage title="Ten link nie jest dostępny">Nie udało się potwierdzić zaproszenia do opinii.</ReviewMessage>
  }

  const context = (data ?? {}) as ReviewInvitationContext
  if (!context.valid || !context.propertyId || !context.propertyTitle) {
    return <ReviewMessage title="Ten link wygasł lub jest nieprawidłowy">Opinie po wizycie można dodać wyłącznie przez indywidualne zaproszenie EnjoyHub.</ReviewMessage>
  }

  if (query.dziekujemy === "1" || context.completed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#fff7f2] to-white px-4 py-12">
        <Card className="mx-auto max-w-xl border-emerald-200 shadow-xl">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <CardTitle className="mt-3 text-2xl">Dziękujemy za opinię</CardTitle>
            <CardDescription>Twoja opinia jest oznaczona jako zweryfikowana wizyta, ponieważ została powiązana ze skasowanym biletem EnjoyHub.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href={`/attractions/${context.propertyId}`}>Zobacz profil atrakcji</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!context.eligible) {
    return <ReviewMessage title="Opinia nie jest jeszcze dostępna">Link aktywuje się po potwierdzonej wizycie i wykorzystaniu biletu.</ReviewMessage>
  }

  const action = submitVerifiedReviewAction.bind(null, token, context.propertyId)
  const firstName = context.recipientName?.split(/\s+/)[0]

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fff7f2] to-white px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff5a1f]/10 text-[#ff5a1f]">
            <Star className="h-6 w-6 fill-current" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{firstName ? `${firstName}, jak było?` : "Jak było?"}</h1>
          <p className="mt-2 text-muted-foreground">Twoja opinia pomoże kolejnym osobom wybrać dobrą atrakcję.</p>
        </div>

        <Card className="overflow-hidden shadow-xl">
          <CardHeader className="border-b bg-white">
            <CardTitle>{context.propertyTitle}</CardTitle>
            {context.propertyCity && (
              <CardDescription className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{context.propertyCity}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p><strong>Zweryfikowana wizyta.</strong> Ten formularz jest dostępny, ponieważ co najmniej jeden bilet z Twojego zamówienia został wykorzystany na wejściu.</p>
            </div>

            {query.blad === "1" && (
              <Alert variant="destructive">
                <AlertTitle>Nie udało się zapisać opinii</AlertTitle>
                <AlertDescription>Wybierz ocenę 1–5 i napisz przynajmniej kilka słów.</AlertDescription>
              </Alert>
            )}

            <form action={action} className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Twoja ocena</legend>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <label key={rating} className="cursor-pointer">
                      <input className="peer sr-only" type="radio" name="rating" value={rating} required />
                      <span className="flex h-12 items-center justify-center rounded-xl border text-sm font-bold transition peer-checked:border-[#ff5a1f] peer-checked:bg-[#fff1eb] peer-checked:text-[#ff5a1f]">
                        {rating} ★
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block space-y-2 text-sm font-semibold">
                <span>Napisz kilka słów</span>
                <textarea
                  name="comment"
                  minLength={3}
                  maxLength={2000}
                  required
                  rows={6}
                  placeholder="Co było najlepsze? Co warto wiedzieć przed wizytą?"
                  className="w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm font-normal outline-none ring-offset-background transition focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/15"
                />
              </label>

              <Button type="submit" className="h-12 w-full bg-[#ff5a1f] font-semibold text-white hover:bg-[#e94f18]">
                Dodaj zweryfikowaną opinię
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">Jedno zamówienie może dodać jedną zweryfikowaną opinię do tej atrakcji.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function ReviewMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="max-w-lg">
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  )
}
