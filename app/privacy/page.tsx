import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { LEGAL_EFFECTIVE_DATE, platformOperator } from "@/lib/legal/marketplace"

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description: "Informacje o przetwarzaniu danych osobowych w serwisie EnjoyHub.",
}

const sections = [
  {
    title: "1. Administrator danych i kontakt",
    content:
      `Administratorem danych przetwarzanych w związku z działaniem platformy EnjoyHub jest ${platformOperator.legalName}, ${platformOperator.address}, NIP ${platformOperator.taxId}, KRS ${platformOperator.krs}. Kontakt w sprawach dotyczących danych osobowych: ${platformOperator.email || "publiczny adres e-mail operatora wskazany w serwisie przed uruchomieniem płatności online"}${platformOperator.phone ? `, tel. ${platformOperator.phone}` : ""}.`,
  },
  {
    title: "2. Jakie dane przetwarzamy",
    content:
      "Możemy przetwarzać dane konta, dane kontaktowe, informacje potrzebne do rezerwacji lub zakupu biletu, historię zamówień i refundów oraz dane techniczne związane z korzystaniem z serwisu. Nie przechowujemy pełnych danych karty płatniczej — obsługuje je zewnętrzny operator płatności.",
  },
  {
    title: "3. Cele przetwarzania",
    content:
      "Dane wykorzystujemy do obsługi konta, zawarcia i obsługi rezerwacji, płatności i refundów, wystawienia i weryfikacji biletu, kontaktu dotyczącego zamówienia, obsługi wsparcia i reklamacji, zapewnienia bezpieczeństwa serwisu, zapobiegania nadużyciom oraz realizacji obowiązków prawnych.",
  },
  {
    title: "4. Organizator atrakcji",
    content:
      "Dane niezbędne do wykonania rezerwacji przekazujemy organizatorowi wskazanemu jako sprzedawca usługi w checkoutcie i potwierdzeniu zamówienia. Organizator wykorzystuje te dane w zakresie niezbędnym do wykonania usługi, obsługi uczestnika, anulowania lub reklamacji oraz własnych obowiązków prawnych. Jego dane kontaktowe są utrwalone przy zamówieniu.",
  },
  {
    title: "5. Pozostali odbiorcy danych",
    content:
      "Dane mogą być powierzane lub udostępniane dostawcom hostingu, bazy danych, płatności, poczty transakcyjnej, narzędzi bezpieczeństwa i innych usług technicznych wykorzystywanych do działania EnjoyHub. Każdy podmiot otrzymuje dane tylko w zakresie potrzebnym do realizacji swojej funkcji i zgodnie z właściwą podstawą prawną.",
  },
  {
    title: "6. Podstawy prawne",
    content:
      "W zależności od sytuacji przetwarzanie odbywa się w celu wykonania umowy lub podjęcia działań na żądanie użytkownika przed jej zawarciem, wykonania obowiązków prawnych, realizacji prawnie uzasadnionych interesów związanych m.in. z bezpieczeństwem, obsługą roszczeń i ulepszaniem serwisu albo na podstawie zgody, jeżeli przepisy wymagają zgody dla danego działania.",
  },
  {
    title: "7. Okres przechowywania",
    content:
      "Dane przechowujemy przez czas potrzebny do realizacji usługi, obsługi reklamacji i rozliczeń, a następnie przez okres wymagany przepisami lub potrzebny do ustalenia, dochodzenia albo obrony roszczeń. Dane konta mogą być przechowywane do jego usunięcia, z wyjątkiem danych, które musimy zachować z innych podstaw prawnych.",
  },
  {
    title: "8. Twoje prawa",
    content:
      "Masz prawo dostępu do danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania, a w odpowiednich przypadkach także przenoszenia danych, wniesienia sprzeciwu i wycofania zgody bez wpływu na zgodność wcześniejszego przetwarzania. Możesz również wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.",
  },
  {
    title: "9. Pliki cookies i analityka",
    content:
      "Serwis używa niezbędnych plików cookies do logowania, utrzymania sesji, checkoutu i bezpieczeństwa. Narzędzia analityczne lub inne technologie niewymagane do podstawowego działania są stosowane zgodnie z obowiązującymi wymogami dotyczącymi zgody i preferencji użytkownika.",
  },
  {
    title: "10. Aktualizacje polityki",
    content:
      "Polityka może być aktualizowana wraz ze zmianą funkcji platformy, dostawców lub przepisów. Aktualna wersja jest publikowana w serwisie wraz z datą obowiązywania.",
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Powrót do strony głównej
        </Link>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Polityka prywatności EnjoyHub</h1>
        <p className="mt-3 text-sm text-muted-foreground">Ostatnia aktualizacja: {LEGAL_EFFECTIVE_DATE}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">{section.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t pt-6 text-sm">
          <Link className="text-primary hover:underline" href="/regulamin">Regulamin EnjoyHub</Link>
          <Link className="text-primary hover:underline" href="/zasady-anulowania">Zasady anulowania i zwrotów</Link>
        </div>
      </div>
    </main>
  )
}
