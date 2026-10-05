import type { Metadata } from "next"
import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "O EnjoyHub",
  description: "Dlaczego powstał EnjoyHub i komu ma pomagać w odkrywaniu oraz rezerwowaniu atrakcji.",
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Wróć do EnjoyHub</Link>

        <article className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">O EnjoyHub</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Chciałem po prostu łatwiej znaleźć coś fajnego do zrobienia.</h1>

          <div className="mt-8 space-y-6 text-base leading-8 text-muted-foreground sm:text-lg">
            <p>
              EnjoyHub powstał z bardzo prostej potrzeby. Chciałem znaleźć fajne miejsce, do którego mógłbym wyjść z dziećmi.
              Szybko okazało się, że samo znalezienie miejsca to dopiero początek. Trzeba jeszcze sprawdzić ofertę, opinie,
              dostępność, a czasem wykonać kilka telefonów. Pomyślałem, że to powinno być prostsze.
            </p>

            <p>
              Chcę, żeby EnjoyHub był miejscem, do którego wchodzisz, gdy masz wolne popołudnie, pada deszcz, chcesz coś zrobić
              z dziećmi, wyskoczyć ze znajomymi albo zorganizować coś większego. Zamiast przeklikiwać dziesiątki stron,
              po prostu wybierasz i rezerwujesz.
            </p>

            <p>
              W Polsce jest mnóstwo świetnych miejsc, o których wiele osób po prostu nie wie. EnjoyHub ma pomóc je odkrywać
              i łatwo z nich korzystać.
            </p>

            <p className="font-semibold text-foreground">
              Bez dzwonienia, bez chaosu. Wchodzisz, wybierasz, rezerwujesz i dobrze spędzasz czas.
            </p>
          </div>
        </article>
      </div>

      <SiteFooter />
    </main>
  )
}
