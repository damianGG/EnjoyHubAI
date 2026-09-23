import { Check, Clock3, HelpCircle, ShieldCheck, Target, Trees, Users } from "lucide-react"

export type PaintballPackage = {
  id: string
  name: string
  description?: string
  duration: number
  minPlayers: number
  maxPlayers?: number
  includes: string[]
  arrival?: string
  cancellation?: string
  minAge?: number
  balls?: number
  unlimitedBalls?: boolean
  variant?: string
  pricingModel?: string
  tickets: { name: string; price: number; currency: string }[]
}

export type PaintballProfileData = {
  facts: Record<string, unknown>
  packages: PaintballPackage[]
}

const labels: Record<string, string> = {
  terrain_forest: "Pole leśne",
  terrain_cqb: "Budynki / CQB",
  terrain_urban: "Teren miejski",
  terrain_bunkers: "Bunkry i okopy",
  parking_available: "Parking",
  toilet_available: "Toaleta",
  covered_rest_area: "Zadaszona strefa odpoczynku",
  grill_or_bonfire_available: "Grill lub ognisko",
  catering_available: "Catering",
  field_exclusive_available: "Możliwa gra na wyłączność",
  birthday_party: "Urodziny",
  corporate_event: "Integracje firmowe",
  bachelor_party: "Wieczory kawalerskie i panieńskie",
  school_groups: "Grupy szkolne",
  kids_paintball_available: "Oferta dla dzieci",
  low_impact_available: "Low impact",
  classic_paintball_available: "Klasyczny paintball",
}

const variants: Record<string, string> = {
  classic_068: "Klasyczny paintball",
  low_impact_050: "Low impact",
  gotcha: "Gotcha",
  gel_blaster: "Gel blaster",
  laser_paintball: "Laser paintball",
}

export function PaintballProfile({ data, online }: { data: PaintballProfileData | null; online: boolean }) {
  const facts = data?.facts ?? {}
  const packages = data?.packages ?? []
  const features = Object.entries(labels).filter(([key]) => facts[key] === true)

  const environment = ({
    outdoor: "Na zewnątrz",
    indoor: "Pod dachem",
    mixed: "Wewnątrz i na zewnątrz",
  } as Record<string, string>)[String(facts.environment_type)]

  return (
    <div className="space-y-10">
      <nav aria-label="Informacje o paintballu" className="flex gap-2 overflow-x-auto border-y border-[#0b1220]/[0.07] py-3 text-sm">
        {[
          ["paintball-facts", "Pole i udogodnienia"],
          ["paintball-packages", "Pakiety i ceny"],
          ["paintball-before", "Przed wizytą"],
          ["location", "Dojazd"],
        ].map(([id, name]) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-full px-3 py-2 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {name}
          </a>
        ))}
      </nav>

      <section id="paintball-facts" className="scroll-mt-24 space-y-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Adrenalina · Paintball</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Najważniejsze informacje przed wyborem gry</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sprawdź wielkość obiektu, charakter terenu i warunki dla grupy. Szczegóły pakietu wybierzesz niżej.
          </p>
        </div>

        <div className="grid grid-cols-2 border-y border-[#0b1220]/[0.07] sm:grid-cols-4">
          {[
            [Target, "Liczba pól", facts.field_count],
            [Users, "Graczy jednocześnie", facts.max_players_simultaneously],
            [Trees, "Rodzaj obiektu", environment],
            [Clock3, "Dostępność", facts.year_round === true ? "Cały rok" : facts.year_round === false ? "Sezonowo" : null],
          ].map(([Icon, label, value], index) => {
            const Symbol = Icon as typeof Target
            return (
              <div
                key={String(label)}
                className={`py-4 pr-3 ${index % 2 ? "border-l border-[#0b1220]/[0.07] pl-4" : ""} ${index > 1 ? "border-t border-[#0b1220]/[0.07] sm:border-t-0" : ""} sm:border-l sm:px-4 sm:first:border-l-0 sm:first:pl-0`}
              >
                <Symbol className="mb-2 h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">{String(label)}</p>
                <p className="mt-1 text-sm font-semibold">{typeof value === "string" || typeof value === "number" ? value : "Zapytaj organizatora"}</p>
              </div>
            )
          })}
        </div>

        {features.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Co znajdziesz na miejscu</h3>
            <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {features.map(([key, label]) => (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section id="paintball-packages" className="scroll-mt-24 space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Pakiety i ceny</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Porównaj czas gry, wielkość grupy, liczbę kulek i wyposażenie. Wybierz pakiet dopiero wtedy, gdy odpowiada Waszej ekipie.
          </p>
        </div>

        {packages.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[#0b1220]/15 p-5">
            <p className="font-semibold">Ustal pakiet dla swojej grupy</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Organizator nie opublikował jeszcze szczegółowych pakietów. Zapytaj o cenę, liczbę kulek, czas gry i minimalną wielkość grupy.
            </p>
            <a className="mt-4 inline-flex font-semibold text-primary underline underline-offset-4" href="#booking">
              Sprawdź możliwości kontaktu
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {packages.map((item) => (
              <article key={item.id} className="rounded-[24px] border border-[#0b1220]/[0.08] bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {variants[item.variant ?? ""] || "Pakiet paintballowy"}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">{item.name}</h3>
                    {item.description && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{item.description}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    {item.tickets.length ? (
                      <>
                        <p className="text-xs text-muted-foreground">od</p>
                        <p className="text-xl font-semibold tracking-tight">
                          {new Intl.NumberFormat("pl-PL", { style: "currency", currency: item.tickets[0].currency }).format(
                            Math.min(...item.tickets.map((ticket) => ticket.price)),
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold">Cena do ustalenia</p>
                    )}
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[#0b1220]/[0.07] py-4 text-sm sm:grid-cols-4">
                  {[
                    ["Czas", `${item.duration} min`],
                    ["Grupa", `${item.minPlayers}${item.maxPlayers ? `–${item.maxPlayers}` : "+"} os.`],
                    ["Minimalny wiek", item.minAge != null ? `${item.minAge} lat` : "Zapytaj organizatora"],
                    ["Kulki", item.unlimitedBalls === true ? "Bez limitu" : item.balls != null ? `${item.balls} szt.` : "Zapytaj organizatora"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-4">
                    {item.includes.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">W cenie</h4>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {item.includes.map((value, index) => (
                            <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                              {value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {item.tickets.length > 1 && (
                      <div className="space-y-1 text-sm">
                        {item.tickets.map((ticket, index) => (
                          <p key={index} className="flex max-w-md justify-between gap-4">
                            <span className="text-muted-foreground">{ticket.name}</span>
                            <strong>{new Intl.NumberFormat("pl-PL", { style: "currency", currency: ticket.currency }).format(ticket.price)}</strong>
                          </p>
                        ))}
                      </div>
                    )}

                    {item.pricingModel && (
                      <p className="text-xs text-muted-foreground">
                        {item.pricingModel === "per_group"
                          ? "Cena za grupę"
                          : item.pricingModel === "per_person"
                            ? "Cena za osobę"
                            : "Sprawdź jednostkę ceny u organizatora"}
                      </p>
                    )}
                  </div>

                  <a
                    href="#booking"
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    {online ? "Sprawdź terminy" : "Zapytaj o pakiet"}
                  </a>
                </div>

                {(item.arrival || item.cancellation) && (
                  <div className="mt-5 space-y-3 border-t border-[#0b1220]/[0.07] pt-4 text-sm">
                    {item.arrival && <p className="whitespace-pre-line"><strong>Przyjazd: </strong>{item.arrival}</p>}
                    {item.cancellation && (
                      <details>
                        <summary className="cursor-pointer font-semibold">Odwołanie i zmiana terminu</summary>
                        <p className="mt-2 whitespace-pre-line text-muted-foreground">{item.cancellation}</p>
                      </details>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="paintball-before" className="scroll-mt-24 space-y-4 border-t border-[#0b1220]/[0.07] pt-8">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5" />
            Przed wizytą
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Cztery rzeczy, które warto potwierdzić przed rezerwacją, jeśli nie zostały opisane w wybranym pakiecie.
          </p>
        </div>

        <div className="divide-y divide-[#0b1220]/[0.07] border-y border-[#0b1220]/[0.07]">
          {[
            ["Czy mogą grać dzieci?", "Sprawdź minimalny wiek dla wybranego wariantu oraz wymaganą zgodę lub obecność opiekuna."],
            ["Co zabrać i jaki sprzęt jest w cenie?", "Sprawdź listę wyposażenia w pakiecie. Zapytaj o strój, obuwie, ochronę i możliwość dokupienia kulek."],
            ["Co w razie deszczu lub zmiany planów?", "Potwierdź zasady gry przy złej pogodzie, przełożenia wizyty, odwołania i ewentualnego zwrotu."],
            ["Czy grupa gra na wyłączność?", "Ustal minimalną liczbę uczestników i to, czy do rozgrywki mogą dołączyć inne osoby."],
          ].map(([question, answer]) => (
            <details key={question} className="py-4">
              <summary className="cursor-pointer text-sm font-semibold">{question}</summary>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>

        {!data && (
          <p className="flex gap-2 text-sm text-muted-foreground">
            <HelpCircle className="h-4 w-4 shrink-0" />
            Szczegóły oferty są chwilowo niedostępne. Skorzystaj z danych kontaktowych obiektu.
          </p>
        )}
      </section>
    </div>
  )
}
