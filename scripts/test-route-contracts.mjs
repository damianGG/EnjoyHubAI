import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"

const repositoryRoot = new URL("../", import.meta.url)

async function fileExists(relativePath) {
  try {
    await access(new URL(relativePath, repositoryRoot))
    return true
  } catch {
    return false
  }
}

async function source(relativePath) {
  return readFile(new URL(relativePath, repositoryRoot), "utf8")
}

const requiredRoutes = [
  "app/page.tsx",
  "app/privacy/page.tsx",
  "app/attractions/[slug]/page.tsx",
  "app/offers/[id]/page.tsx",
  "app/checkout/page.tsx",
  "app/bilety/[productId]/page.tsx",
  "app/host/page.tsx",
  "app/host/skaner/page.tsx",
  "app/host/sprzedaz/page.tsx",
  "app/host/sprzedaz/konfiguracja/page.tsx",
  "app/host/sprzedaz/konfiguracja/actions.ts",
  "components/ticketing/sales-setup-form.tsx",
]

const removedRoutes = [
  "app/demo/page.tsx",
  "app/demo/booking/page.tsx",
  "app/map-demo/page.tsx",
  "app/auth/phone-login/page.tsx",
  "app/host/bookings/page.tsx",
  "app/host/properties/page.tsx",
  "app/host/properties/new/page.tsx",
  "app/host/properties/[id]/page.tsx",
  "app/host/properties/[id]/availability/page.tsx",
  "app/host/properties/[id]/offers/page.tsx",
  "app/api/host/offers/route.ts",
  "app/api/host/offers/[offerId]/availability/route.ts",
  "components/add-attraction-form.tsx",
  "components/edit-attraction-form.tsx",
  "components/availability-manager.tsx",
  "components/host-create-offer-dialog.tsx",
  "components/host-offer-availability-manager.tsx",
  "components/host-offers-manager.tsx",
]

for (const route of requiredRoutes) {
  assert.equal(await fileExists(route), true, `Brakuje wymaganej trasy: ${route}`)
}

for (const route of removedRoutes) {
  assert.equal(await fileExists(route), false, `Wycofana trasa lub moduł nadal istnieje: ${route}`)
}

const bookingFlow = await source("components/multi-slot-booking-widget.tsx")
assert.doesNotMatch(bookingFlow, /\/offers\/\$\{firstSlot\.offerId\}\/book/)
assert.match(bookingFlow, /\/offers\/\$\{firstSlot\.offerId\}\?\$\{queryParams\.toString\(\)\}/)

const nextConfig = await source("next.config.mjs")
assert.match(nextConfig, /source: '\/properties\/:id'/)
assert.match(nextConfig, /destination: '\/attractions\/:id'/)
assert.match(nextConfig, /source: '\/host\/properties'/)
assert.match(nextConfig, /source: '\/host\/properties\/:path\*'/)
assert.match(nextConfig, /destination: '\/host\/sprzedaz\/konfiguracja'/)
assert.match(nextConfig, /source: '\/host\/bookings'/)
assert.match(nextConfig, /destination: '\/host\/sprzedaz'/)

for (const file of [
  "app/dashboard/favorites/page.tsx",
  "app/dashboard/bookings/page.tsx",
]) {
  assert.doesNotMatch(await source(file), /href=\{`\/properties\//)
}

const authForm = await source("components/unified-auth-form.tsx")
assert.match(authForm, /href="\/privacy"/)

const metadata = await source("app/layout.tsx")
assert.doesNotMatch(metadata, /v0 App|Created with v0|v0\.app/)

const hostSales = await source("app/host/sprzedaz/page.tsx")
assert.match(hostSales, /\/host\/sprzedaz\/konfiguracja/)
assert.match(hostSales, /\.select\("organization_id, role"\)/)
assert.match(hostSales, /Konto kasjera nie ma dostępu/)

const hostPanel = await source("app/host/page.tsx")
assert.match(hostPanel, /\.from\("organization_memberships"\)/)
assert.doesNotMatch(hostPanel, /\.from\("(?:properties|bookings|offers)"\)/)

for (const file of ["components/top-nav.tsx", "components/bottom-nav.tsx", "app/dashboard/page.tsx"]) {
  assert.doesNotMatch(await source(file), /\/host\/properties|\/host\/bookings/)
}

const publicTicketingOffer = await source("app/bilety/[productId]/page.tsx")
assert.match(publicTicketingOffer, /\/checkout\/\$\{session\.id\}/)

const ticketingCron = await source("app/api/cron/ticketing-cleanup/route.ts")
assert.match(ticketingCron, /ticketing_extend_active_sessions/)

process.stdout.write("Route contracts OK\n")
