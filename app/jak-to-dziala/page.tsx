import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck2, MapPinned, Search, TicketCheck } from "lucide-react"

import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Jak działa EnjoyHub",
  description: "Zobacz, jak znaleźć atrakcję, sprawdzić termin i zarezerwować ją w EnjoyHub.",
}

const steps = [
  { icon: Search, title: "1. Znajdź atrakcję", text: "Wyszukaj miejsce, kategorię albo pomysł na wolny czas i zawęź wyniki filtrami." },
  { icon: MapPinned, title: "2. Sprawdź szczegóły", text: "Zobacz opis, lokalizację, zasady oferty, organizatora i dostępne opcje." },
  { icon: CalendarCheck2, title: "3. Wybierz termin", text: "Jeżeli organizator prowadzi sprzedaż w EnjoyHub, wybierz konkretny termin i liczbę biletów." },
  { icon: TicketCheck, title: "4. Zarezerwuj", text: "Przejdź przez checkout. Po potwierdzeniu płatności otrzymasz rezerwację i bilety." },
] as const

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Wróć do EnjoyHub</Link>

        <section className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Jak to działa</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Od pomysłu do rezerwacji w kilku krokach</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            EnjoyHub łączy wyszukiwanie atrakcji, dostępność terminów i rezerwację w jednym miejscu.
          </p>
        </section>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {steps.map(({ icon: Icon, title, text }) => (
            <section key={title} className="rounded-3xl border p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-5 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-3xl bg-muted/40 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Prowadzisz atrakcję?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Dodaj obiekt do EnjoyHub i zarządzaj ofertą, terminami i rezerwacjami.</p>
          </div>
          <Button asChild className="mt-5 sm:mt-0"><Link href="/dla-organizatorow">Dla organizatorów</Link></Button>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
