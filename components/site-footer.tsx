import Link from "next/link"

import { CookieSettingsButton } from "@/components/analytics/cookie-settings-button"
import { platformOperator } from "@/lib/legal/marketplace"

const sections = [
  {
    title: "Pomoc",
    links: [
      { href: "/jak-to-dziala", label: "Jak działa EnjoyHub" },
      { href: "/kontakt", label: "Kontakt" },
      { href: "/zasady-anulowania", label: "Anulowanie i zwroty" },
    ],
  },
  {
    title: "Dla organizatorów",
    links: [
      { href: "/dla-organizatorow", label: "Dodaj atrakcję" },
      { href: "/host", label: "Panel organizatora" },
    ],
  },
  {
    title: "EnjoyHub",
    links: [
      { href: "/o-nas", label: "O nas" },
      { href: "/regulamin", label: "Regulamin" },
      { href: "/privacy", label: "Polityka prywatności" },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t bg-[#fafafa]">
      <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-4 py-10 sm:px-6 md:grid-cols-3">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link className="transition-colors hover:text-foreground hover:underline" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} EnjoyHub · {platformOperator.legalName} · NIP {platformOperator.taxId}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link className="hover:text-foreground hover:underline" href="/regulamin">Regulamin</Link>
            <Link className="hover:text-foreground hover:underline" href="/privacy">Prywatność</Link>
            <Link className="hover:text-foreground hover:underline" href="/privacy#cookies">Cookies</Link>
            <CookieSettingsButton />
            <Link className="hover:text-foreground hover:underline" href="/kontakt">Kontakt</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
