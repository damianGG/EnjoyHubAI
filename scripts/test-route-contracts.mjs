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
  "app/atrakcje/page.tsx",
  "app/offers/[id]/page.tsx",
  "app/checkout/page.tsx",
  "app/bilety/[productId]/page.tsx",
  "app/dla-organizatorow/page.tsx",
  "app/host/page.tsx",
  "app/host/start/page.tsx",
  "app/host/onboarding/page.tsx",
  "app/host/onboarding/actions.ts",
  "app/host/onboarding/gotowe/page.tsx",
  "app/host/skaner/page.tsx",
  "app/host/sprzedaz/page.tsx",
  "app/host/sprzedaz/konfiguracja/page.tsx",
  "app/host/sprzedaz/konfiguracja/actions.ts",
  "app/api/search/filter-definitions/route.ts",
  "app/api/ticketing/properties/[propertyId]/sessions/route.ts",
  "components/ticketing/marketplace-calendar.tsx",
  "components/dynamic-filter-section.tsx",
  "components/ticketing/clear-organizer-onboarding-draft.tsx",
  "components/ticketing/organizer-onboarding-lite.tsx",
  "components/ticketing/organizer-onboarding-wizard.tsx",
  "components/ticketing/sales-setup-form.tsx",
  "lib/auth/return-to.ts",
  "lib/ticketing/marketplace.ts",
  "lib/marketplace/discovery.ts",
  "supabase/migrations/20260816160000_ticketing_marketplace_bridge.sql",
  "supabase/migrations/20260909204804_ticketing_organizer_onboarding.sql",
  "supabase/migrations/20260915003746_marketplace_search_v2.sql",
  "supabase/migrations/20260915074703_marketplace_search_v3.sql",
  "supabase/migrations/20260915080344_marketplace_search_v4.sql",
  "supabase/migrations/20260915084851_marketplace_dynamic_category_filters.sql",
  "supabase/tests/database/007_ticketing_organizer_onboarding_smoke.sql",
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
  "components/quick-discovery-filters.tsx",
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

const polishAttractionsIndex = await source("app/atrakcje/page.tsx")
assert.match(polishAttractionsIndex, /permanentRedirect\("\/attractions"\)/)

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
assert.match(marketplaceSearch, /createAdminClient/)
assert.match(marketplaceSearch, /marketplace_search_attractions_v5/)
assert.match(marketplaceSearch, /p_guests: guests/)
assert.match(marketplaceSearch, /p_min_price: minPrice/)
assert.match(marketplaceSearch, /p_type_slugs:/)
assert.match(marketplaceSearch, /p_amenities:/)
assert.match(marketplaceSearch, /p_supply_filters: dynamicFilters\.supply/)
assert.match(marketplaceSearch, /p_product_filters: dynamicFilters\.product/)
assert.match(marketplaceSearch, /categorySlugs\.length !== 1/)
assert.match(marketplaceSearch, /MAX_DYNAMIC_FILTER_PAYLOAD_LENGTH/)
assert.match(marketplaceSearch, /Math\.min\(parsedPer, 50\)/)
assert.doesNotMatch(marketplaceSearch, /listMarketplacePropertySessions/)
assert.doesNotMatch(marketplaceSearch, /Promise\.all\(\s*items\.map/)
assert.doesNotMatch(marketplaceSearch, /\.from\("properties"\)/)
assert.doesNotMatch(marketplaceSearch, /price_per_night/)

const filterDefinitionsRoute = await source("app/api/search/filter-definitions/route.ts")
assert.match(filterDefinitionsRoute, /supply_attribute_definitions/)
assert.match(filterDefinitionsRoute, /product_attribute_definitions/)
assert.match(filterDefinitionsRoute, /\.eq\("filterable", true\)/)
assert.match(filterDefinitionsRoute, /scope: "supply" \| "product"/)
assert.match(filterDefinitionsRoute, /parent_category_id/)
assert.doesNotMatch(filterDefinitionsRoute, /subcategory\.category_id/)

const marketplaceSearchMigration = await source("supabase/migrations/20260915084851_marketplace_dynamic_category_filters.sql")
const marketplaceSearchSql = marketplaceSearchMigration.replace(/^--.*$/gm, "")
assert.match(marketplaceSearchMigration, /marketplace_search_attractions_v5/)
assert.match(marketplaceSearchMigration, /marketplace_filter_value_matches/)
assert.match(marketplaceSearchMigration, /security invoker/)
assert.match(marketplaceSearchMigration, /grant execute[\s\S]*to service_role/)
assert.match(marketplaceSearchMigration, /p_supply_filters/)
assert.match(marketplaceSearchMigration, /p_product_filters/)
assert.match(marketplaceSearchMigration, /definition\.filterable = true/)
assert.match(marketplaceSearchMigration, /attribute\.verification_status in \('verified', 'owner_confirmed'\)/)
assert.match(marketplaceSearchMigration, /product\.restrictions/)
assert.match(marketplaceSearchMigration, /p_guests/)
assert.match(marketplaceSearchMigration, /p_min_price/)
assert.match(marketplaceSearchMigration, /row_number\(\) over/)
assert.match(marketplaceSearchMigration, /p_require_availability/)
assert.match(marketplaceSearchMigration, /session\.price_from is not null/)
assert.doesNotMatch(marketplaceSearchSql, /price_per_night/)

const discoveryLoader = await source("lib/marketplace/discovery.ts")
assert.match(discoveryLoader, /marketplace_search_attractions_v5/)
assert.match(discoveryLoader, /p_supply_filters: \{\}/)
assert.match(discoveryLoader, /p_product_filters: \{\}/)
assert.match(discoveryLoader, /p_sort: "relevance"/)
assert.doesNotMatch(discoveryLoader, /\.from\("properties"\)/)
assert.doesNotMatch(discoveryLoader, /price_per_night/)

for (const file of ["app/page.tsx", "app/attractions/page.tsx"]) {
  const discoveryPage = await source(file)
  assert.match(discoveryPage, /listMarketplaceDiscoveryAttractions/)
  assert.doesNotMatch(discoveryPage, /\.from\("properties"\)/)
  assert.doesNotMatch(discoveryPage, /price_per_night/)
}

const attractionsView = await source("components/attractions-view.tsx")
assert.match(attractionsView, /\/api\/search\?\$\{params\.toString\(\)\}/)
assert.match(attractionsView, /\/api\/search\/filter-definitions\?category=/)
assert.match(attractionsView, /useUrlState/)
assert.match(attractionsView, /min_price:/)
assert.match(attractionsView, /types:/)
assert.match(attractionsView, /amenities:/)
assert.match(attractionsView, /attrs: serializeDynamicFilters/)
assert.match(attractionsView, /selectedDynamicCategory/)
assert.doesNotMatch(attractionsView, /onSearch=\{\(\) => undefined\}/)
assert.doesNotMatch(attractionsView, /price_per_night/)

const attractionFilters = await source("components/attraction-filters.tsx")
assert.match(attractionFilters, /DynamicFilterSection/)
assert.match(attractionFilters, /dynamicDefinitions/)

const dynamicFilterSection = await source("components/dynamic-filter-section.tsx")
assert.match(dynamicFilterSection, /Filtry dla:/)
assert.match(dynamicFilterSection, /Pakiet \/ oferta/)
assert.match(dynamicFilterSection, /definition\.valueType === "boolean"/)
assert.match(dynamicFilterSection, /definition\.valueType === "select"/)
assert.match(dynamicFilterSection, /definition\.valueType === "number"/)

const searchDialog = await source("components/search-dialog.tsx")
assert.match(searchDialog, /CATEGORY_GROUPS/)
assert.match(searchDialog, /Podkategoria/)
assert.match(searchDialog, /Filtry główne/)
assert.match(searchDialog, /DynamicFilterSection/)
assert.match(searchDialog, /\/api\/search\/filter-definitions\?category=/)
assert.match(searchDialog, /attrs: serializeDynamicFilters/)
assert.match(searchDialog, /min_price:/)
assert.match(searchDialog, /max_price:/)
assert.doesNotMatch(searchDialog, /<ScrollArea/)
assert.doesNotMatch(searchDialog, /absolute inset-x-0 bottom-0/)
assert.match(searchDialog, /overflow-y-auto/)
assert.match(searchDialog, /shrink-0 border-t/)

for (const file of ["components/home-discovery.tsx", "components/discovery-chrome.tsx"]) {
  assert.doesNotMatch(await source(file), /QuickDiscoveryFilters|quick-discovery-filters/)
}

const categoryBar = await source("components/category-bar.tsx")
assert.match(categoryBar, /const localSelectedGroup =/)
assert.match(categoryBar, /const selectedCategoryData = localSelectedGroup \?\? activeGroup/)
assert.match(categoryBar, /if \(!useNavigation\) \{[\s\S]*navigate\(group\?\.subcategories/)
assert.match(categoryBar, /handleSubcategorySelect[\s\S]*navigate\(slug \|\| selectedCategoryData/)

const attractionMap = await source("components/attraction-map.tsx")
assert.match(attractionMap, /Sprawdź ofertę/)
assert.doesNotMatch(attractionMap, /price_per_night/)

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

const attractionCard = await source("components/AttractionCard.tsx")
assert.match(attractionCard, /Najbliższy termin:/)
assert.doesNotMatch(attractionCard, /Najbliżej:/)

const userAvatar = await source("components/user-avatar.tsx")
assert.match(userAvatar, /Mój panel/)
assert.match(userAvatar, /aria-label="Otwórz menu konta"/)
assert.doesNotMatch(userAvatar, /Moje konto|placeholder\.svg/)

const rootLayout = await source("app/layout.tsx")
const organizerStart = await source("app/host/start/page.tsx")
const organizerLandingBrand = await source("app/dla-organizatorow/page.tsx")
for (const brandedSurface of [rootLayout, organizerStart, organizerLandingBrand]) {
  assert.doesNotMatch(brandedSurface, /placeholder-logo\.svg/)
  assert.match(brandedSurface, /enjoyhub-icon\.svg/)
}

const categoryManagement = await source("components/category-management.tsx")
assert.doesNotMatch(categoryManagement, /Add Category|Cancel|Category updated|Category created|Failed to|Error loading categories|e\.g\.,/)
assert.match(categoryManagement, /Dodaj kategorię/)
assert.match(categoryManagement, /Anuluj/)

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
assert.match(hostSales, /organizerSalesRoles/)
assert.match(hostSales, /Obsługa wejścia nie ma dostępu/)
assert.match(hostSales, /\/host\/skaner/)

const hostPanel = await source("app/host/page.tsx")
assert.match(hostPanel, /\.from\("organization_memberships"\)/)
assert.match(hostPanel, /href="\/host\/start"/)
assert.doesNotMatch(hostPanel, /\.from\("(?:properties|bookings|offers)"\)/)

for (const file of ["components/top-nav.tsx", "app/dashboard/page.tsx"]) {
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

const organizerLanding = await source("app/dla-organizatorow/page.tsx")
assert.match(organizerLanding, /href="\/host\/start"/)
assert.match(organizerLanding, /Mam własny system/)

const topNavigation = await source("components/top-nav.tsx")
assert.match(topNavigation, /usePathname/)
assert.match(topNavigation, /returnToPath=\{returnToPath\}/)
assert.doesNotMatch(topNavigation, /returnToPath="\/"|returnToPath='\/'/)
assert.match(topNavigation, /href="\/dla-organizatorow"/)
assert.match(topNavigation, /href="\/attractions"/)
assert.doesNotMatch(topNavigation, /href="\/atrakcje"/)
assert.doesNotMatch(topNavigation, />Dashboard</)
assert.match(topNavigation, /Dla organizatorów/)
assert.match(topNavigation, /Dodaj atrakcję/)

const hostSettlements = await source("app/host/rozliczenia/page.tsx")
assert.doesNotMatch(hostSettlements, /STRIPE_CONNECT_ENABLED|webhooka Connect|zastosowaniu migracji/)
assert.match(hostSettlements, /Wypłaty dla organizatorów nie są jeszcze aktywne/)

const organizerOnboarding = await source("app/host/onboarding/actions.ts")
assert.match(organizerOnboarding, /ticketing_complete_organizer_onboarding_v2/)

const organizerOnboardingUi = await source("components/ticketing/organizer-onboarding-lite.tsx")
assert.match(organizerOnboardingUi, /organizer-onboarding-lite\.v4/)
assert.match(organizerOnboardingUi, /Szkic zapisujemy automatycznie/)
assert.match(organizerOnboardingUi, /Czy prowadzisz rezerwacje również poza EnjoyHub/)
assert.match(organizerOnboardingUi, /Ostatnia wizyta faktycznie zakończy się/)
assert.match(organizerOnboardingUi, /Od kiedy klienci mogą rezerwować/)
assert.match(organizerOnboardingUi, /Cena za całą grupę i termin/)
assert.match(organizerOnboardingUi, /Wybierz rodzaj atrakcji/)
assert.match(organizerOnboardingUi, /!isLegacyDraft && \(saved\.salesMode/)
assert.match(organizerOnboardingUi, /Dalej: ustaw terminy/)
assert.doesNotMatch(organizerOnboardingUi, /ticketPrice: "50"/)
assert.doesNotMatch(organizerOnboardingUi, /useState<SalesMode>\("allocated_quota"\)/)
assert.doesNotMatch(organizerOnboardingUi, /useState<number\[\]>\(\[1, 2, 3, 4, 5, 6, 7\]\)/)

const organizerOnboardingComplete = await source("app/host/onboarding/gotowe/page.tsx")
assert.match(organizerOnboardingComplete, /Uruchom sprzedaż krok po kroku/)
assert.match(organizerOnboardingComplete, /href="\/host\/weryfikacja"/)
assert.match(organizerOnboardingComplete, /href="\/host\/rozliczenia"/)

const organizerDashboard = await source("app/host/page.tsx")
assert.match(organizerDashboard, /Połącz płatności i rachunek/)
assert.match(organizerDashboard, /isStripeConnectEnabled \? "\/host\/rozliczenia" : "\/host\/weryfikacja"/)

const organizerOnboardingMigration = await source("supabase/migrations/20260909204804_ticketing_organizer_onboarding.sql")
assert.match(organizerOnboardingMigration, /ticketing_create_sales_setup/)
assert.match(organizerOnboardingMigration, /ticketing_link_venue_property/)
assert.match(organizerOnboardingMigration, /insert into public\.properties/)

const organizerOnboardingSafetyMigration = await source("supabase/migrations/20260920113000_organizer_onboarding_safety_p0.sql")
assert.match(organizerOnboardingSafetyMigration, /ticketing_complete_organizer_onboarding_v2/)
assert.match(organizerOnboardingSafetyMigration, /p_available_from/)
assert.match(organizerOnboardingSafetyMigration, /p_subcategory_id/)
assert.match(organizerOnboardingSafetyMigration, /pricing_model/)

const publicTicketingOffer = await source("app/bilety/[productId]/page.tsx")
assert.match(publicTicketingOffer, /\/checkout\/\$\{session\.id\}/)
assert.match(publicTicketingOffer, /za grupę/)
assert.match(publicTicketingOffer, /Termin dostępny dla jednej grupy/)

const checkoutForm = await source("components/ticketing/checkout-form.tsx")
assert.match(checkoutForm, /Cena obejmuje cały termin dla jednej grupy/)
assert.match(checkoutForm, /Rezerwacja grupowa/)

const ticketingQueries = await source("lib/ticketing/queries.ts")
assert.match(ticketingQueries, /pricingModelFromRestrictions/)
assert.match(ticketingQueries, /restrictions\?\.pricing_model === "per_group"/)

const ticketingCron = await source("app/api/cron/ticketing-cleanup/route.ts")
assert.match(ticketingCron, /ticketing_extend_active_sessions/)

process.stdout.write("Route contracts OK\n")
