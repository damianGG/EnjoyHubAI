import type { Metadata } from "next"
import Link from "next/link"

import {
  LEGAL_EFFECTIVE_DATE,
  MARKETPLACE_TERMS_VERSION,
  platformOperator,
} from "@/lib/legal/marketplace"

export const metadata: Metadata = {
  title: "Regulamin EnjoyHub",
  description: "Regulamin korzystania z platformy EnjoyHub i zawierania rezerwacji z organizatorami atrakcji.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Wróć do EnjoyHub</Link>
        <div className="mt-5 rounded-3xl border bg-background p-6 shadow-sm sm:p-10">
          <div className="border-b pb-7">
            <p className="text-sm font-semibold text-primary">EnjoyHub · wersja {MARKETPLACE_TERMS_VERSION}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Regulamin platformy EnjoyHub</h1>
            <p className="mt-3 text-sm text-muted-foreground">Obowiązuje od {LEGAL_EFFECTIVE_DATE}</p>
          </div>

          <LegalSection title="1. Operator platformy">
            <p>Platformę EnjoyHub prowadzi <strong>{platformOperator.legalName}</strong>, {platformOperator.address}, NIP {platformOperator.taxId}, KRS {platformOperator.krs}, REGON {platformOperator.regon}.</p>
            <p>Kontakt: {platformOperator.email ? <a className="text-primary underline" href={`mailto:${platformOperator.email}`}>{platformOperator.email}</a> : "adres e-mail zostanie wskazany przed uruchomieniem płatności online"}{platformOperator.phone ? `, tel. ${platformOperator.phone}` : "; numer telefonu zostanie wskazany przed uruchomieniem płatności online"}.</p>
          </LegalSection>

          <LegalSection title="2. Czym jest EnjoyHub i kto sprzedaje usługę">
            <p>EnjoyHub jest internetową platformą handlową umożliwiającą wyszukiwanie atrakcji, rezerwowanie terminów i opłacanie rezerwacji oferowanych przez niezależnych organizatorów.</p>
            <p><strong>Sprzedawcą i wykonawcą usługi atrakcji jest organizator wskazany przy ofercie i bezpośrednio przed zakupem.</strong> Umowa dotycząca udziału w atrakcji jest zawierana pomiędzy klientem a tym organizatorem.</p>
            <p>EnjoyHub odpowiada za funkcjonowanie platformy, proces rezerwacji, techniczną obsługę płatności i biletu oraz — w zakresie opisanym w regulaminie — może pośredniczyć w obsłudze anulowań i refundów. Organizator odpowiada za prawidłowe wykonanie atrakcji, jej bezpieczeństwo, zgodność opisu z rzeczywistością i realizację obowiązków sprzedawcy wobec klienta.</p>
          </LegalSection>

          <LegalSection title="3. Informacje o organizatorze">
            <p>Przed złożeniem płatnego zamówienia klient otrzymuje co najmniej nazwę prawną organizatora, NIP, adres, e-mail i numer telefonu. Jeżeli organizator podlega wpisowi do rejestru, może zostać wskazana również nazwa rejestru i numer wpisu.</p>
            <p>EnjoyHub dopuszcza płatności online wyłącznie dla organizatorów oznaczonych w systemie jako przedsiębiorcy i zweryfikowanych do sprzedaży.</p>
          </LegalSection>

          <LegalSection title="4. Zawarcie umowy i rezerwacja">
            <p>Klient wybiera ofertę, termin, rodzaj i liczbę biletów, podaje dane kontaktowe, zapoznaje się z warunkami oferty, zasadami anulowania oraz tym regulaminem, a następnie składa zamówienie przyciskiem wyraźnie wskazującym obowiązek zapłaty.</p>
            <p>Przed rozpoczęciem płatności miejsca mogą zostać czasowo zablokowane. Rezerwacja staje się potwierdzona po skutecznym zaksięgowaniu płatności i wystawieniu biletów lub innego potwierdzenia w systemie.</p>
            <p>Każde zamówienie zapisuje wersję regulaminu, zasady anulowania i dane sprzedawcy przedstawione klientowi w chwili składania zamówienia.</p>
          </LegalSection>

          <LegalSection title="5. Ceny i płatności">
            <p>Bezpośrednio przed zakupem klient widzi łączną cenę zamówienia w walucie wskazanej w checkoutcie. Nie doliczamy opłat, które nie zostały pokazane przed złożeniem zamówienia.</p>
            <p>Płatności są obsługiwane przez zewnętrznego operatora płatności. EnjoyHub może pobierać od organizatora prowizję za sprzedaż; prowizja ta nie zmienia ceny pokazanej klientowi, chyba że oferta wyraźnie stanowi inaczej przed zakupem.</p>
          </LegalSection>

          <LegalSection title="6. Bilety i korzystanie z atrakcji">
            <p>Bilet lub kod dostępu jest przypisany do konkretnego zamówienia i może zostać użyty zgodnie z opisem oferty. Organizator może wymagać okazania kodu QR lub innego potwierdzenia przy wejściu.</p>
            <p>Klient nie powinien udostępniać aktywnego kodu biletu osobom trzecim, jeżeli mogłoby to doprowadzić do jego wykorzystania bez zgody klienta.</p>
          </LegalSection>

          <LegalSection title="7. Anulowanie i zwroty">
            <p>Szczegółowe zasady anulowania są pokazywane przy ofercie i w checkoutcie. Stanowią część warunków konkretnej rezerwacji. Domyślnie EnjoyHub stosuje politykę pełnego zwrotu przy anulowaniu najpóźniej 24 godziny przed terminem, chyba że dana oferta wyraźnie wskazuje inne zasady.</p>
            <p>Jeżeli organizator odwoła usługę albo nie może wykonać jej zgodnie z umową, klientowi przysługuje zwrot odpowiedniej kwoty. Szczegóły opisuje strona <Link className="text-primary underline" href="/zasady-anulowania">Zasady anulowania i zwrotów</Link>.</p>
          </LegalSection>

          <LegalSection title="8. Prawo odstąpienia od umowy">
            <p>W przypadku usług związanych z wypoczynkiem, wydarzeniami rozrywkowymi, sportowymi lub kulturalnymi świadczonych w oznaczonym dniu lub okresie ustawowe 14-dniowe prawo odstąpienia od umowy zawartej na odległość co do zasady nie przysługuje. Niezależnie od tego klient może korzystać z dobrowolnej polityki anulowania pokazanej przed zakupem.</p>
          </LegalSection>

          <LegalSection title="9. Reklamacje">
            <p>Reklamacje dotyczące przebiegu lub wykonania atrakcji należy kierować do organizatora będącego sprzedawcą usługi. Dane kontaktowe organizatora są pokazane przed zakupem i utrwalone przy zamówieniu.</p>
            <p>Reklamacje dotyczące działania platformy EnjoyHub, procesu płatności, dostępu do biletu lub technicznej obsługi refundu można kierować do operatora EnjoyHub. EnjoyHub może również przekazać organizatorowi zgłoszenie dotyczące realizacji atrakcji.</p>
          </LegalSection>

          <LegalSection title="10. Opinie">
            <p>EnjoyHub może umożliwiać publikowanie opinii. Opinie oznaczone jako „Zweryfikowana wizyta” są powiązane z rezerwacją, dla której system odnotował rzeczywiste wykorzystanie biletu. Szczegółowy mechanizm może być rozwijany wraz z funkcjami platformy.</p>
          </LegalSection>

          <LegalSection title="11. Plasowanie ofert">
            <p>Kolejność ofert może uwzględniać m.in. dopasowanie do zapytania i filtrów klienta, dostępność terminów, lokalizację, cenę, ocenę, liczbę opinii, popularność oraz jakość i kompletność oferty. Płatne promowanie, jeżeli zostanie uruchomione, będzie wyraźnie oznaczone i nie będzie ukrywane jako wynik organiczny.</p>
          </LegalSection>

          <LegalSection title="12. Odpowiedzialność">
            <p>Organizator odpowiada za wykonanie sprzedawanej usługi, zgodność oferty z rzeczywistością, wymagane pozwolenia i bezpieczeństwo uczestników. EnjoyHub odpowiada za własne obowiązki jako operator platformy i nie ogranicza praw konsumenta wynikających z bezwzględnie obowiązujących przepisów.</p>
            <p>Postanowienia regulaminu nie wyłączają ani nie ograniczają odpowiedzialności, której zgodnie z prawem nie można wyłączyć wobec konsumenta.</p>
          </LegalSection>

          <LegalSection title="13. Dane osobowe">
            <p>Zasady przetwarzania danych osobowych są opisane w <Link className="text-primary underline" href="/privacy">Polityce prywatności</Link>. Dane niezbędne do realizacji rezerwacji mogą być przekazywane właściwemu organizatorowi jako stronie umowy o usługę.</p>
          </LegalSection>

          <LegalSection title="14. Zmiany regulaminu">
            <p>Regulamin może być aktualizowany wraz ze zmianą prawa lub funkcji platformy. Nowa wersja nie zmienia warunków już zawartego zamówienia — dla każdego zamówienia zachowywana jest wersja warunków zaakceptowana przy zakupie.</p>
          </LegalSection>

          <LegalSection title="15. Prawo właściwe i spory">
            <p>Do korzystania z EnjoyHub stosuje się prawo polskie, z poszanowaniem bezwzględnie obowiązujących praw konsumenta. Konsument może korzystać z dostępnych ustawowo pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń.</p>
          </LegalSection>
        </div>
      </div>
    </main>
  )
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-7 last:border-0 last:pb-0">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}
