import type { Metadata } from "next"
import Link from "next/link"

import {
  CANCELLATION_POLICY_VERSION,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/legal/marketplace"

export const metadata: Metadata = {
  title: "Zasady anulowania i zwrotów | EnjoyHub",
  description: "Zasady anulowania rezerwacji i refundów w EnjoyHub.",
}

export default function CancellationPolicyPage() {
  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Wróć do EnjoyHub</Link>
        <div className="mt-5 rounded-3xl border bg-background p-6 shadow-sm sm:p-10">
          <div className="border-b pb-7">
            <p className="text-sm font-semibold text-primary">EnjoyHub · wersja {CANCELLATION_POLICY_VERSION}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Zasady anulowania i zwrotów</h1>
            <p className="mt-3 text-sm text-muted-foreground">Obowiązują od {LEGAL_EFFECTIVE_DATE}</p>
          </div>

          <PolicySection title="1. Zasada najważniejsza">
            <p>Przy każdej płatnej ofercie klient przed zakupem widzi konkretną politykę anulowania. To właśnie warunki pokazane w checkoutcie i zapisane przy zamówieniu rozstrzygają, jakie dobrowolne prawo do anulowania przysługuje dla danej rezerwacji.</p>
          </PolicySection>

          <PolicySection title="2. Domyślna polityka EnjoyHub — pełny zwrot do 24 h">
            <p>Jeżeli oferta nie wskazuje innych zasad, klient może anulować rezerwację i otrzymać pełny zwrot zapłaconej kwoty, jeżeli zgłoszenie anulowania dotrze do organizatora lub EnjoyHub najpóźniej 24 godziny przed godziną rozpoczęcia atrakcji.</p>
            <p>Po tym terminie nie ma automatycznego prawa do refundu z inicjatywy klienta, ale organizator może dobrowolnie zaakceptować pełny lub częściowy zwrot.</p>
          </PolicySection>

          <PolicySection title="3. Oferta bezzwrotna">
            <p>Organizator może oznaczyć ofertę jako bezzwrotną. Informacja o tym musi być wyraźnie pokazana przed zakupem. W takim przypadku klient nie ma dobrowolnego prawa do anulowania z refundem, chyba że organizator sam przyzna zwrot albo bezwzględnie obowiązujące przepisy stanowią inaczej.</p>
          </PolicySection>

          <PolicySection title="4. Indywidualne zasady organizatora">
            <p>Organizator może ustalić własne zasady, np. inny termin bezpłatnego anulowania. Jeżeli są stosowane, ich pełna treść jest prezentowana klientowi przed złożeniem zamówienia i zapisywana przy rezerwacji.</p>
          </PolicySection>

          <PolicySection title="5. Odwołanie lub istotna zmiana po stronie organizatora">
            <p>Jeżeli organizator odwoła atrakcję albo nie może wykonać usługi zgodnie z zawartą umową, klient otrzymuje należny zwrot. W typowym przypadku całkowitego odwołania atrakcji jest to pełna kwota zapłacona za rezerwację.</p>
            <p>Jeżeli tylko część świadczenia nie może zostać wykonana, możliwy jest odpowiedni zwrot częściowy.</p>
          </PolicySection>

          <PolicySection title="6. Jak wykonywany jest refund">
            <p>Zwrot jest kierowany przez system płatności do metody płatniczej użytej przy zakupie, o ile operator płatności i przepisy nie wymagają innego sposobu. Czas zaksięgowania po wykonaniu refundu zależy od operatora płatności i banku klienta.</p>
            <p>EnjoyHub przechowuje historię refundu powiązaną z zamówieniem. Pełny refund może unieważnić niewykorzystane bilety.</p>
          </PolicySection>

          <PolicySection title="7. Usługi na konkretny termin a ustawowe odstąpienie">
            <p>W przypadku usług związanych z wypoczynkiem, wydarzeniami rozrywkowymi, sportowymi lub kulturalnymi świadczonych w oznaczonym dniu albo okresie ustawowe 14-dniowe prawo odstąpienia od umowy zawartej na odległość co do zasady nie przysługuje. Dobrowolne zasady anulowania opisane wyżej mogą jednak dawać klientowi dodatkowe uprawnienie do zwrotu.</p>
          </PolicySection>

          <PolicySection title="8. Gdzie zgłosić anulowanie lub problem">
            <p>Prośbę o anulowanie należy zgłosić organizatorowi na dane kontaktowe zapisane przy zamówieniu albo przez kanał wsparcia EnjoyHub, jeżeli jest dostępny przy danej rezerwacji. Przy ocenie terminu anulowania liczy się moment skutecznego otrzymania zgłoszenia.</p>
          </PolicySection>

          <PolicySection title="9. Powiązanie z regulaminem">
            <p>Niniejsze zasady stanowią uzupełnienie <Link href="/regulamin" className="text-primary underline">Regulaminu EnjoyHub</Link>. Jeżeli dana oferta ma wyraźnie wskazaną indywidualną politykę anulowania, ma ona pierwszeństwo w zakresie dobrowolnych warunków refundu tej konkretnej rezerwacji, z zachowaniem praw konsumenta wynikających z bezwzględnie obowiązujących przepisów.</p>
          </PolicySection>
        </div>
      </div>
    </main>
  )
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-7 last:border-0 last:pb-0">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}
