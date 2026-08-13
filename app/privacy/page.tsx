import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description: "Informacje o przetwarzaniu danych osobowych w serwisie EnjoyHub.",
}

const sections = [
  {
    title: "1. Administrator danych",
    content:
      "Administratorem danych osobowych jest operator serwisu EnjoyHub. W sprawach dotyczących danych osobowych możesz skorzystać z danych kontaktowych wskazanych w serwisie lub w wiadomości potwierdzającej rezerwację.",
  },
  {
    title: "2. Jakie dane przetwarzamy",
    content:
      "Możemy przetwarzać dane konta, dane kontaktowe, informacje potrzebne do rezerwacji lub zakupu biletu oraz dane techniczne związane z korzystaniem z serwisu. Nie przechowujemy pełnych danych karty płatniczej — obsługuje je zewnętrzny operator płatności.",
  },
  {
    title: "3. Cele przetwarzania",
    content:
      "Dane wykorzystujemy do obsługi konta, rezerwacji, płatności, wystawienia i weryfikacji biletu, kontaktu dotyczącego zamówienia, zapewnienia bezpieczeństwa serwisu oraz realizacji obowiązków prawnych.",
  },
  {
    title: "4. Odbiorcy danych",
    content:
      "Dane mogą być powierzane dostawcom hostingu, bazy danych, płatności i komunikacji oraz właścicielowi obiektu, którego dotyczy rezerwacja. Każdy podmiot otrzymuje wyłącznie dane niezbędne do wykonania swojej usługi.",
  },
  {
    title: "5. Okres przechowywania",
    content:
      "Dane przechowujemy przez czas potrzebny do realizacji usługi, obsługi reklamacji i rozliczeń, a następnie przez okres wymagany przepisami lub do czasu przedawnienia ewentualnych roszczeń.",
  },
  {
    title: "6. Twoje prawa",
    content:
      "Masz prawo dostępu do danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania, a w odpowiednich przypadkach także przenoszenia danych, wniesienia sprzeciwu i skargi do Prezesa Urzędu Ochrony Danych Osobowych.",
  },
  {
    title: "7. Pliki cookies",
    content:
      "Serwis może używać niezbędnych plików cookies do logowania, utrzymania sesji i bezpieczeństwa oraz narzędzi analitycznych pomagających ulepszać działanie EnjoyHub.",
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do strony głównej
        </Link>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Polityka prywatności EnjoyHub</h1>
        <p className="mt-3 text-sm text-muted-foreground">Ostatnia aktualizacja: 13 sierpnia 2026 r.</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">{section.content}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
