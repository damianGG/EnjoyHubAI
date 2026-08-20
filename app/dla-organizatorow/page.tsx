import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  CircleHelp,
  CreditCard,
  Headphones,
  QrCode,
  Store,
  TicketCheck,
} from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Sprzedawaj bilety online",
  description:
    "Uruchom sprzedaż biletów do swojej atrakcji z EnjoyHub — także wtedy, gdy korzystasz już z własnej kasy.",
}

const steps = [
  {
    icon: Store,
    title: "Dodaj swój obiekt",
    description: "Podajesz nazwę, krótki opis i lokalizację. Pokażemy Ci dokładnie, co wpisać.",
  },
  {
    icon: TicketCheck,
    title: "Ustaw bilety i terminy",
    description: "Dodajesz ceny, liczbę miejsc oraz dni i godziny wejść.",
  },
  {
    icon: QrCode,
    title: "Przyjmuj klientów",
    description: "Klient płaci online i otrzymuje bilet QR, który sprawdzasz przy wejściu.",
  },
]

const benefits = [
  "Kalendarz wolnych terminów na stronie atrakcji",
  "Płatność online i automatyczne bilety QR",
  "Kontrola liczby dostępnych miejsc",
  "Panel zamówień i prosty skaner biletów",
]

export default function OrganizerLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2" aria-label="EnjoyHub — strona główna">
            <Image src="/placeholder-logo.svg" alt="" width={40} height={40} className="h-9 w-9" />
            <span className="text-xl font-bold text-primary">EnjoyHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/auth/login?next=/host/start">Mam już konto</Link>
            </Button>
            <Button asChild>
              <Link href="/host/start">Zacznij <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative border-b">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,oklch(0.63_0.24_275/0.16),transparent_36%),radial-gradient(circle_at_85%_20%,oklch(0.72_0.18_215/0.14),transparent_30%)]" />
        <div className="container mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-5">Dla właścicieli atrakcji</Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Sprzedawaj bilety online. <span className="text-primary">Bez wywracania obiektu do góry nogami.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Masz już kasę lub własny system? Możesz przeznaczyć dla EnjoyHub tylko część miejsc.
              Nie masz sprzedaży online? EnjoyHub może obsłużyć cały proces.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-7 text-base">
                <Link href="/host/start">Dodaj swoją atrakcję <ArrowRight className="h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                <Link href="#jak-to-dziala">Zobacz, jak to działa</Link>
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Headphones className="h-4 w-4 text-primary" /> Nie musisz znać się na technologii — kreator prowadzi krok po kroku.
            </p>
          </div>

          <Card className="surface-3d border-primary/20 bg-background/95">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary">Przykładowa sprzedaż</p>
                  <h2 className="mt-1 text-2xl font-semibold">Park Przygody</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <BadgeCheck className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-7 space-y-3">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Bilet normalny</span>
                    <span className="font-semibold">50 zł</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Sobota, 10:00 · 18 miejsc</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Bilet ulgowy</span>
                    <span className="font-semibold">35 zł</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Sobota, 11:00 · 20 miejsc</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-primary/10 p-4">
                  <CreditCard className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Płatność online</p>
                </div>
                <div className="rounded-xl bg-secondary/20 p-4">
                  <QrCode className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-medium">Bilet QR</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="jak-to-dziala" className="container mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Prosty początek</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Trzy rzeczy i możesz zacząć</h2>
          <p className="mt-4 text-muted-foreground">Bez tabel, instrukcji technicznych i ręcznego ustawiania bazy danych.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <Card key={step.title} className="lift-3d h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge variant="outline" className="mb-4">Dopasowane do Twojego obiektu</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Twoja obecna kasa może zostać</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Wybierasz model, który pasuje do sposobu pracy obiektu. Na początku możesz udostępnić w EnjoyHub niewielką pulę miejsc i zwiększyć ją później.
            </p>
            <ul className="mt-6 space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <Store className="h-7 w-7 text-primary" />
                <h3 className="mt-4 font-semibold">Mam własny system</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Wydzielasz pulę biletów dla EnjoyHub. Kasjerzy nadal korzystają z obecnego rozwiązania.
                </p>
              </CardContent>
            </Card>
            <Card className="border-secondary/30">
              <CardContent className="p-6">
                <CalendarClock className="h-7 w-7 text-primary" />
                <h3 className="mt-4 font-semibold">Zaczynam od zera</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  EnjoyHub prowadzi kalendarz, sprzedaż, liczbę miejsc i kontrolę wejścia.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
        <div>
          <CircleHelp className="h-8 w-8 text-primary" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight">Najczęstsze pytania</h2>
          <p className="mt-3 text-muted-foreground">Krótko i bez technicznego języka.</p>
        </div>
        <Accordion type="single" collapsible className="rounded-2xl border px-5">
          <AccordionItem value="system">
            <AccordionTrigger>Czy muszę zrezygnować z obecnej kasy?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">
              Nie. W kreatorze wybierzesz wydzieloną pulę miejsc dla EnjoyHub. Obecny system i sposób pracy kasjerów mogą pozostać bez zmian.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="technical">
            <AccordionTrigger>Czy muszę znać się na systemach sprzedaży?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">
              Nie. Zobaczysz krótkie kroki, przykłady i podsumowanie przed uruchomieniem. EnjoyHub tworzy całą konfigurację w tle.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="ticket">
            <AccordionTrigger>Co otrzyma klient po zakupie?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">
              Po potwierdzeniu płatności powstaje bilet z kodem QR. Przy wejściu możesz sprawdzić go prostym skanerem w panelu EnjoyHub.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="help">
            <AccordionTrigger>Co jeśli potrzebuję pomocy?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">
              Możesz przygotować szkic samodzielnie, a przed startem wspólnie sprawdzimy ofertę, ceny, terminy i testowy zakup.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="container mx-auto max-w-6xl px-4 pb-16 sm:pb-20">
        <div className="overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Przygotuj pierwszą ofertę</h2>
            <p className="mt-3 max-w-2xl text-primary-foreground/80">
              Wystarczy nazwa obiektu, krótki opis, ceny biletów oraz typowe dni i godziny otwarcia.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="mt-7 h-12 shrink-0 px-7 lg:mt-0">
            <Link href="/host/start">Rozpocznij krok po kroku <ArrowRight className="h-5 w-5" /></Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
