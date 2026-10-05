import type { Metadata } from "next"
import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { platformOperator } from "@/lib/legal/marketplace"

export const metadata: Metadata = {
  title: "O EnjoyHub",
  description: "Poznaj EnjoyHub — platformę do odkrywania atrakcji, sprawdzania terminów i rezerwowania biletów online.",
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Wróć do EnjoyHub</Link>

        <section className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">O EnjoyHub</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Mniej szukania. Więcej przeżyć.</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            EnjoyHub pomaga odkrywać atrakcje w jednym miejscu, porównywać oferty, sprawdzać dostępne terminy i rezerwować je online.
            Budujemy platformę zarówno dla osób szukających pomysłu na wolny czas, jak i dla organizatorów, którzy chcą łatwiej docierać do klientów.
          </p>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["Odkrywaj", "Znajdź atrakcje według lokalizacji, kategorii i potrzeb swojej grupy."],
            ["Sprawdzaj", "Zobacz dostępne terminy, warunki oferty i informacje o organizatorze."],
            ["Rezerwuj", "Wybierz termin i przejdź przez prosty proces rezerwacji i płatności online."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl border bg-card p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-3xl bg-muted/40 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Kto prowadzi EnjoyHub?</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Operatorem platformy jest <strong className="text-foreground">{platformOperator.legalName}</strong>, {platformOperator.address}.
            NIP {platformOperator.taxId}, KRS {platformOperator.krs}, REGON {platformOperator.regon}.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild><Link href="/jak-to-dziala">Jak działa EnjoyHub</Link></Button>
            <Button asChild variant="outline"><Link href="/kontakt">Kontakt</Link></Button>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
