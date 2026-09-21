import { Target, Users, Clock3, ShieldCheck, Trees, Check, HelpCircle } from "lucide-react"

export type PaintballPackage = {
  id: string; name: string; description?: string; duration: number; minPlayers: number; maxPlayers?: number
  includes: string[]; arrival?: string; cancellation?: string; minAge?: number; balls?: number
  unlimitedBalls?: boolean; variant?: string; pricingModel?: string
  tickets: { name: string; price: number; currency: string }[]
}
export type PaintballProfileData = { facts: Record<string, unknown>; packages: PaintballPackage[] }
const labels: Record<string, string> = {
  terrain_forest: "Pole leśne", terrain_cqb: "Budynki / CQB", terrain_urban: "Teren miejski", terrain_bunkers: "Bunkry i okopy",
  parking_available: "Parking", toilet_available: "Toaleta", covered_rest_area: "Zadaszona strefa odpoczynku",
  grill_or_bonfire_available: "Grill lub ognisko", catering_available: "Catering", field_exclusive_available: "Możliwa gra na wyłączność",
  birthday_party: "Urodziny", corporate_event: "Integracje firmowe", bachelor_party: "Wieczory kawalerskie i panieńskie", school_groups: "Grupy szkolne",
  kids_paintball_available: "Oferta dla dzieci", low_impact_available: "Low impact", classic_paintball_available: "Klasyczny paintball",
}
const variants: Record<string, string> = { classic_068: "Klasyczny paintball", low_impact_050: "Low impact", gotcha: "Gotcha", gel_blaster: "Gel blaster", laser_paintball: "Laser paintball" }

export function PaintballProfile({ data, online }: { data: PaintballProfileData | null; online: boolean }) {
  const facts = data?.facts ?? {}
  const packages = data?.packages ?? []
  const features = Object.entries(labels).filter(([key]) => facts[key] === true)
  return <div className="space-y-8">
    <nav aria-label="Informacje o paintballu" className="flex gap-2 overflow-x-auto pb-2 text-sm">
      {[["paintball-facts", "Pole i udogodnienia"], ["paintball-packages", "Pakiety i ceny"], ["paintball-before", "Przed wizytą"], ["location", "Dojazd"]].map(([id, name]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-full border px-4 py-2 hover:border-primary hover:text-primary">{name}</a>)}
    </nav>
    <section id="paintball-facts" className="scroll-mt-24 space-y-4">
      <div className="rounded-2xl bg-[#132b21] p-6 text-white">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-200">Adrenalina / Paintball</p>
        <h2 className="text-2xl font-bold">Zbierz ekipę. Wybierz swoją grę.</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-50">Porównaj pakiety, sprawdź warunki i zaplanuj wizytę w tym obiekcie.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[[Target, "Liczba pól", facts.field_count], [Users, "Graczy jednocześnie", facts.max_players_simultaneously], [Trees, "Rodzaj obiektu", ({outdoor:"Na zewnątrz",indoor:"Pod dachem",mixed:"Wewnątrz i na zewnątrz"} as Record<string,string>)[String(facts.environment_type)]], [Clock3, "Dostępność sezonowa", facts.year_round === true ? "Cały rok" : facts.year_round === false ? "Sezonowo" : null]].map(([Icon, label, value]) => {
          const Symbol = Icon as typeof Target
          return <div key={String(label)} className="rounded-2xl border p-4"><Symbol className="mb-2 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{String(label)}</p><p className="mt-1 font-semibold">{typeof value === "string" || typeof value === "number" ? value : "Zapytaj organizatora"}</p></div>
        })}
      </div>
      {features.length > 0 && <ul className="grid gap-3 sm:grid-cols-2">{features.map(([key,label]) => <li key={key} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-600" />{label}</li>)}</ul>}
    </section>
    <section id="paintball-packages" className="scroll-mt-24 space-y-4">
      <h2 className="text-xl font-bold">Pakiety i ceny</h2>
      <p className="text-sm text-muted-foreground">Wiek uczestników, liczba kulek i wyposażenie mogą różnić się między pakietami.</p>
      {packages.length === 0 ? <div className="rounded-2xl border border-dashed p-5"><p className="font-semibold">Ustal pakiet dla swojej grupy</p><p className="mt-2 text-sm text-muted-foreground">Organizator nie opublikował jeszcze szczegółowych pakietów. Zapytaj o cenę, liczbę kulek, czas gry i minimalną wielkość grupy.</p><a className="mt-4 inline-block font-semibold text-primary underline" href="#booking">Sprawdź możliwości kontaktu</a></div> : packages.map(item => <article key={item.id} className="space-y-4 rounded-2xl border p-5">
        <div><p className="text-xs font-medium text-primary">{variants[item.variant ?? ""] || "Pakiet paintballowy"}</p><h3 className="mt-1 text-lg font-bold">{item.name}</h3>{item.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{item.description}</p>}</div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[["Czas", `${item.duration} min`], ["Grupa", `${item.minPlayers}${item.maxPlayers ? `–${item.maxPlayers}` : "+"} os.`], ["Minimalny wiek", item.minAge != null ? `${item.minAge} lat` : "Zapytaj organizatora"], ["Kulki", item.unlimitedBalls === true ? "Bez limitu" : item.balls != null ? `${item.balls} szt.` : "Zapytaj organizatora"]].map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
        </dl>
        {item.includes.length > 0 && <div><h4 className="mb-2 text-sm font-semibold">W cenie</h4><ul className="space-y-1 text-sm">{item.includes.map((value,index)=><li key={index} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{value}</li>)}</ul></div>}
        <div className="rounded-xl bg-muted/50 p-3 text-sm">{item.tickets.length ? item.tickets.map((ticket,index)=><p key={index} className="flex justify-between gap-3"><span>{ticket.name}</span><strong>{new Intl.NumberFormat('pl-PL',{style:'currency',currency:ticket.currency}).format(ticket.price)}</strong></p>) : <p>Cena do ustalenia z organizatorem</p>}{item.pricingModel && <p className="mt-2 text-xs text-muted-foreground">{item.pricingModel === "per_group" ? "Cena za grupę" : item.pricingModel === "per_person" ? "Cena za osobę" : "Sprawdź jednostkę ceny u organizatora"}</p>}</div>
        {item.arrival && <p className="whitespace-pre-line text-sm"><strong>Przyjazd: </strong>{item.arrival}</p>}
        {item.cancellation && <details className="text-sm"><summary className="cursor-pointer font-semibold">Odwołanie i zmiana terminu</summary><p className="mt-2 whitespace-pre-line">{item.cancellation}</p></details>}
        <a href="#booking" className="inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{online ? "Sprawdź dostępne terminy i wybierz pakiet" : "Zapytaj o ten pakiet"}</a>
      </article>)}
    </section>
    <section id="paintball-before" className="scroll-mt-24 space-y-4 rounded-2xl bg-muted/40 p-5">
      <h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5" />Przed wizytą</h2>
      <p className="text-sm text-muted-foreground">Przed rezerwacją potwierdź z organizatorem poniższe kwestie, jeśli nie zostały opisane w pakiecie.</p>
      {[["Czy mogą grać dzieci?", "Sprawdź minimalny wiek dla wybranego wariantu oraz wymaganą zgodę lub obecność opiekuna."], ["Co zabrać i jaki sprzęt jest w cenie?", "Sprawdź listę wyposażenia w pakiecie. Zapytaj o strój, obuwie, ochronę i możliwość dokupienia kulek."], ["Co w razie deszczu lub zmiany planów?", "Potwierdź zasady gry przy złej pogodzie, przełożenia wizyty, odwołania i ewentualnego zwrotu."], ["Czy grupa gra na wyłączność?", "Ustal minimalną liczbę uczestników i to, czy do rozgrywki mogą dołączyć inne osoby."]].map(([question,answer])=><details key={question} className="border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">{question}</summary><p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p></details>)}
      {!data && <p className="flex gap-2 text-sm text-muted-foreground"><HelpCircle className="h-4 w-4 shrink-0" />Szczegóły oferty są chwilowo niedostępne. Skorzystaj z danych kontaktowych obiektu.</p>}
    </section>
  </div>
}
