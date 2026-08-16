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
  "app/api/ticketing/properties/[propertyId]/sessions/route.ts",
  "components/ticketing/marketplace-calendar.tsx",
  "components/ticketing/sales-setup-form.tsx",
  "lib/auth/return-to.ts",
  "lib/ticketing/marketplace.ts",
  "supabase/migrations/20260816160000_ticketing_marketplace_bridge.sql",
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
  "app/admin/offers/[offerId]/availability/page.tsx",
  "app/api/admin/offers/[offerId]/availability/route.ts",
  "app/api/admin/offers/route.ts",
  "app/api/attractions/[id]/availability/route.ts",
  "app/api/attractions/[id]/block-dates/route.ts",
  "app/api/attractions/[id]/settings/route.ts",
  "app/api/bookings/route.ts",
  "app/api/check-availability/route.ts",
  "app/api/offers/[offerId]/slots/route.ts",
  "app/api/properties/[propertyId]/day-slots/route.ts",
  "app/api/properties/[propertyId]/month-availability/route.ts",
  "app/booking-confirmation/[id]/page.tsx",
  "components/availability-calendar-card.tsx",
  "components/booking-card.tsx",
  "components/booking-widget-demo.tsx",
  "components/booking-widget.tsx",
  "components/create-offer-dialog.tsx",
  "components/multi-slot-booking-widget.tsx",
  "components/offer-availability-manager.tsx",
  "components/slot-availability-widget.tsx",
  "lib/booking-actions.ts",
  "lib/offers/getNextAvailableSlot.ts",
  "lib/properties/getAvailabilityForPropertyOnDate.ts",
]

for (const route of requiredRoutes) {
  assert.equal(await fileExists(route), true, `Brakuje wymaganej trasy: ${route}`)
}

for (const route of removedRoutes) {
  assert.equal(await fileExists(route), false, `Wycofana trasa lub moduł nadal istnieje: ${route}`)
}

const attractionPage = await source("app/attractions/[slug]/page.tsx")
assert.match(attractionPage, /MarketplaceCalendar/)
assert.match(attractionPage, /getMarketplaceTicketingVenue/)
assert.doesNotMatch(attractionPage, /\.from\("(?:offers|offer_availability|offer_bookings|bookings)"\)/)

const marketplaceCalendar = await source("components/ticketing/marketplace-calendar.tsx")
assert.match(marketplaceCalendar, /\/api\/ticketing\/properties\/\$\{propertyId\}\/sessions/)
assert.match(marketplaceCalendar, /\/checkout\/\$\{session\.id\}/)
assert.doesNotMatch(marketplaceCalendar, /\/offers\//)

const legacyOffer = await source("app/offers/[id]/page.tsx")
assert.match(legacyOffer, /permanentRedirect\(`\/attractions\/\$\{offer\.place_id\}`\)/)
assert.doesNotMatch(legacyOffer, /BookingWidget|\/api\/bookings/)

const marketplaceSearch = await source("app/api/search/route.ts")
assert.match(marketplaceSearch, /listMarketplacePropertySessions/)
assert.match(marketplaceSearch, /Math\.min\(parsedPer, 50\)/)
assert.doesNotMatch(marketplaceSearch, /getNextAvailableSlot|getAvailabilityForPropertyOnDate/)

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

const authReturnTo = await source("lib/auth/return-to.ts")
assert.match(authReturnTo, /candidate\.startsWith\("\/"\)/)
assert.match(authReturnTo, /candidate\.startsWith\("\/\/"\)/)
assert.match(authReturnTo, /parsed\.origin !== returnToOrigin/)

const authActions = await source("lib/actions.ts")
assert.match(authActions, /getAuthCallbackUrl\(formData\.get\("next"\)\)/)

const loginForm = await source("components/login-form.tsx")
assert.match(loginForm, /name="next" value=\{destination\}/)

const authCallback = await source("app/auth/callback/route.ts")
assert.match(authCallback, /getSafeAuthReturnTo\(requestUrl\.searchParams\.get\("next"\)\)/)

const loginPage = await source("app/auth/login/page.tsx")
assert.match(loginPage, /returnToPath=\{returnTo\}/)

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

for (const file of ["app/dashboard/page.tsx", "app/dashboard/bookings/page.tsx"]) {
  const dashboard = await source(file)
  assert.match(dashboard, /listCustomerTicketingOrders/)
  assert.doesNotMatch(dashboard, /\.from\("bookings"\)/)
}

const marketplaceSetup = await source("app/host/sprzedaz/konfiguracja/actions.ts")
assert.match(marketplaceSetup, /ticketing_create_marketplace_sales_setup/)
assert.match(marketplaceSetup, /ticketing_link_venue_property/)

const marketplaceMigration = await source("supabase/migrations/20260816160000_ticketing_marketplace_bridge.sql")
assert.match(marketplaceMigration, /ticketing_list_property_sessions/)
assert.match(marketplaceMigration, /venues_property_id_unique_idx/)
assert.match(marketplaceMigration, /product\.inventory_mode in \('native_enjoyhub', 'allocated_quota'\)/)
assert.match(marketplaceMigration, /session\.capacity > inventory\.reserved_capacity/)
assert.match(marketplaceMigration, /sessions_select_order_customers/)

const publicTicketingOffer = await source("app/bilety/[productId]/page.tsx")
assert.match(publicTicketingOffer, /\/checkout\/\$\{session\.id\}/)

const ticketingCron = await source("app/api/cron/ticketing-cleanup/route.ts")
assert.match(ticketingCron, /ticketing_extend_active_sessions/)

process.stdout.write("Route contracts OK\n")
