import type { Metadata } from "next"
import Link from "next/link"
import { Mail, Phone } from "lucide-react"

import { SiteFooter } from "@/components/site-footer"
import { platformOperator } from "@/lib/legal/marketplace"

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Skontaktuj się z zespołem EnjoyHub w sprawie rezerwacji, platformy lub współpracy.",
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Wróć do EnjoyHub</Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Kontakt</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Jak możemy pomóc?</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Napisz do nas w sprawie działania EnjoyHub, rezerwacji, płatności albo współpracy jako organizator.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border p-6">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="mt-4 font-semibold">E-mail</h2>
            {platformOperator.email ? (
              <a className="mt-2 block text-sm text-primary hover:underline" href={"mailto:" + platformOperator.email}>
                {platformOperator.email}
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Adres kontaktowy zostanie opublikowany przed uruchomieniem płatności online.</p>
            )}
          </section>

          <section className="rounded-3xl border p-6">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="mt-4 font-semibold">Telefon</h2>
            {platformOperator.phone ? (
              <a className="mt-2 block text-sm text-primary hover:underline" href={"tel:" + platformOperator.phone.replace(/\s/g, "")}>
                {platformOperator.phone}
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Numer kontaktowy zostanie opublikowany przed uruchomieniem płatności online.</p>
            )}
          </section>
        </div>

        <section className="mt-10 rounded-3xl bg-muted/40 p-6">
          <h2 className="text-xl font-semibold">Dane operatora</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {platformOperator.legalName}<br />
            {platformOperator.address}<br />
            NIP {platformOperator.taxId} · KRS {platformOperator.krs} · REGON {platformOperator.regon}
          </p>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
