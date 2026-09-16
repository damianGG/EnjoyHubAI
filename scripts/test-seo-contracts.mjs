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

for (const file of [
  "app/robots.ts",
  "app/sitemap.ts",
  "app/attractions/[slug]/page.tsx",
  "app/atrakcje/[city]/page.tsx",
  "app/atrakcje/[city]/[category]/page.tsx",
  "app/admin/seo/page.tsx",
  "app/admin/seo/actions.ts",
  "components/attractions-view.tsx",
  "components/seo/marketplace-landing.tsx",
  "components/seo/related-attractions.tsx",
  "lib/seo/attraction.ts",
  "lib/seo/internal-linking.ts",
  "lib/seo/landings.ts",
  "lib/seo/indexnow.ts",
  "lib/seo/quality.ts",
  "lib/seo/site-entity.ts",
  "public/db13ebf9007a99a14b35f8d474700d02.txt",
  "supabase/migrations/20260916155824_programmatic_local_seo.sql",
  "supabase/migrations/20260916160949_programmatic_local_seo_quality_gate.sql",
]) {
  assert.equal(await fileExists(file), true, `Brakuje fundamentu SEO: ${file}`)
}

const robots = await source("app/robots.ts")
assert.match(robots, /OAI-SearchBot/)
assert.match(robots, /ChatGPT-User/)
assert.match(robots, /sitemap:/)
assert.match(robots, /"\/admin"/)
assert.match(robots, /"\/api"/)
assert.match(robots, /"\/checkout"/)

const sitemap = await source("app/sitemap.ts")
assert.match(sitemap, /PAGE_SIZE = 1000/)
assert.match(sitemap, /\.eq\("is_active", true\)/)
assert.match(sitemap, /\.eq\("seo_excluded", false\)/)
assert.match(sitemap, /updated_at/)
assert.match(sitemap, /generateAttractionSlug/)
assert.match(sitemap, /for \(let from = 0; ; from \+= PAGE_SIZE\)/)
assert.match(sitemap, /getSeoLandingCatalog/)
assert.match(sitemap, /isSeoCityIndexable/)
assert.match(sitemap, /isSeoCategoryIndexable/)
assert.match(sitemap, /getSeoLandingPath/)
assert.doesNotMatch(sitemap, /\?categories=/)

const attractionSeo = await source("lib/seo/attraction.ts")
assert.match(attractionSeo, /cache\(async \(id: string\)/)
assert.match(attractionSeo, /\.eq\("is_active", true\)/)
assert.match(attractionSeo, /getAttractionCanonicalPath/)
assert.match(attractionSeo, /getAttractionCanonicalUrl/)
assert.match(attractionSeo, /AggregateRating/)
assert.match(attractionSeo, /"@type": "Review"/)
assert.match(attractionSeo, /"@type": "Offer"/)
assert.match(attractionSeo, /BreadcrumbList/)
assert.match(attractionSeo, /TouristAttraction/)
assert.match(attractionSeo, /LocalBusiness/)
assert.match(attractionSeo, /GeoCoordinates/)
assert.match(attractionSeo, /ReserveAction/)
assert.match(attractionSeo, /serializeJsonLd/)
assert.doesNotMatch(attractionSeo, /FAQPage/)

const attractionPage = await source("app/attractions/[slug]/page.tsx")
assert.match(attractionPage, /export async function generateMetadata/)
assert.match(attractionPage, /alternates:/)
assert.match(attractionPage, /canonical: canonicalUrl/)
assert.match(attractionPage, /openGraph:/)
assert.match(attractionPage, /twitter:/)
assert.match(attractionPage, /max-image-preview/)
assert.match(attractionPage, /permanentRedirect\(canonicalPath\)/)
assert.match(attractionPage, /application\/ld\+json/)
assert.match(attractionPage, /buildAttractionJsonLd/)
assert.match(attractionPage, /getAttractionInternalLinking/)
assert.match(attractionPage, /applyAttractionInternalBreadcrumbs/)
assert.match(attractionPage, /seoLinking\.city\.path/)
assert.match(attractionPage, /seoLinking\.category\.path/)
assert.match(attractionPage, /<RelatedAttractions sections=\{seoLinking\.relatedSections\}/)
assert.match(attractionPage, /aria-label="Okruszki"/)
assert.doesNotMatch(attractionPage, /\.from\("properties"\)/)

const discoveryView = await source("components/attractions-view.tsx")
assert.match(discoveryView, /function attractionHref\(attraction: Attraction\)/)
assert.match(discoveryView, /generateAttractionSlug/)
assert.match(discoveryView, /<Link href=\{attractionHref\(attraction\)\}/)

const internalLinking = await source("lib/seo/internal-linking.ts")
assert.match(internalLinking, /getAttractionInternalLinking/)
assert.match(internalLinking, /getSeoLandingCatalog/)
assert.match(internalLinking, /isSeoCityIndexable/)
assert.match(internalLinking, /isSeoCategoryIndexable/)
assert.match(internalLinking, /getSeoLanding\(catalogCity\.slug\)/)
assert.match(internalLinking, /\.eq\("seo_excluded", false\)/)
assert.match(internalLinking, /categoryItems\.length >= 2/)
assert.match(internalLinking, /cityItems\.length >= 2/)
assert.match(internalLinking, /applyAttractionInternalBreadcrumbs/)
assert.match(internalLinking, /node\["@type"\] === "BreadcrumbList"/)

const relatedAttractions = await source("components/seo/related-attractions.tsx")
assert.match(relatedAttractions, /getSeoAttractionPath/)
assert.match(relatedAttractions, /Zobacz wszystkie/)
assert.match(relatedAttractions, /section\.items\.map/)

const landingSeo = await source("lib/seo/landings.ts")
assert.match(landingSeo, /SEO_CITY_MIN_OBJECTS = 3/)
assert.match(landingSeo, /SEO_CITY_CATEGORY_MIN_OBJECTS = 2/)
assert.match(landingSeo, /seoEligibleCount/)
assert.match(landingSeo, /seo_eligible_count/)
assert.match(landingSeo, /city\.seoEligibleCount >= SEO_CITY_MIN_OBJECTS/)
assert.match(landingSeo, /category\.seoEligibleCount >= SEO_CITY_CATEGORY_MIN_OBJECTS/)
assert.match(landingSeo, /marketplace_seo_catalog_v1/)
assert.match(landingSeo, /marketplace_seo_landing_v1/)
assert.match(landingSeo, /getSeoLandingPath/)
assert.match(landingSeo, /CollectionPage/)
assert.match(landingSeo, /ItemList/)
assert.match(landingSeo, /BreadcrumbList/)

const marketplaceLanding = await source("components/seo/marketplace-landing.tsx")
assert.match(marketplaceLanding, /indexableCategories = catalogCity\.categories\.filter\(isSeoCategoryIndexable\)/)
assert.match(marketplaceLanding, /indexableCategories\.map/)

const cityLandingPage = await source("app/atrakcje/[city]/page.tsx")
assert.match(cityLandingPage, /export async function generateMetadata/)
assert.match(cityLandingPage, /isSeoCityIndexable/)
assert.match(cityLandingPage, /robots:/)
assert.match(cityLandingPage, /canonical/)
assert.match(cityLandingPage, /application\/ld\+json/)
assert.match(cityLandingPage, /permanentRedirect/)

const categoryLandingPage = await source("app/atrakcje/[city]/[category]/page.tsx")
assert.match(categoryLandingPage, /export async function generateMetadata/)
assert.match(categoryLandingPage, /isSeoCategoryIndexable/)
assert.match(categoryLandingPage, /robots:/)
assert.match(categoryLandingPage, /canonical/)
assert.match(categoryLandingPage, /application\/ld\+json/)
assert.match(categoryLandingPage, /permanentRedirect/)

const localMigration = await source("supabase/migrations/20260916155824_programmatic_local_seo.sql")
assert.match(localMigration, /generated always as \(public\.marketplace_location_slug\(city\)\) stored/)
assert.match(localMigration, /properties_active_city_slug_idx/)
assert.match(localMigration, /marketplace_seo_catalog_v1/)
assert.match(localMigration, /marketplace_seo_landing_v1/)
assert.match(localMigration, /security invoker/i)
assert.match(localMigration, /grant execute on function public\.marketplace_seo_catalog_v1\(\) to service_role/i)
assert.match(localMigration, /grant execute on function public\.marketplace_seo_landing_v1\(text, text, integer, integer\) to service_role/i)

const qualityMigration = await source("supabase/migrations/20260916160949_programmatic_local_seo_quality_gate.sql")
assert.match(qualityMigration, /seo_excluded boolean not null default false/i)
assert.match(qualityMigration, /length\(btrim\(coalesce\(p\.description, ''\)\)\) >= 50/)
assert.match(qualityMigration, /cardinality\(coalesce\(p\.images, array\[\]::text\[\]\)\) >= 1/)
assert.match(qualityMigration, /seo_eligible_count/)
assert.match(qualityMigration, /security invoker/i)
assert.match(qualityMigration, /grant execute on function public\.marketplace_seo_catalog_v1\(\) to service_role/i)

const siteEntity = await source("lib/seo/site-entity.ts")
assert.match(siteEntity, /"@type": "Organization"/)
assert.match(siteEntity, /"@type": "WebSite"/)
assert.match(siteEntity, /EnjoyHub\.app/)
assert.match(siteEntity, /enjoyhub-icon\.svg/)
const homepage = await source("app/page.tsx")
assert.match(homepage, /buildSiteEntityJsonLd/)
assert.match(homepage, /application\/ld\+json/)

const indexNow = await source("lib/seo/indexnow.ts")
assert.match(indexNow, /https:\/\/api\.indexnow\.org\/indexnow/)
assert.match(indexNow, /MAX_BATCH_SIZE = 10_000/)
assert.match(indexNow, /keyLocation/)
assert.match(indexNow, /submitIndexNowUrls/)
assert.match(indexNow, /submitIndexNowForAttractionId/)
assert.match(indexNow, /submitIndexNowSeoSnapshot/)
assert.match(indexNow, /\.eq\("seo_excluded", false\)/)
const indexNowKey = (await source("public/db13ebf9007a99a14b35f8d474700d02.txt")).trim()
assert.equal(indexNowKey, "db13ebf9007a99a14b35f8d474700d02")
assert.match(indexNow, new RegExp(indexNowKey))

const quality = await source("lib/seo/quality.ts")
for (const requirement of ["title", "description", "address", "category", "image", "gps"]) {
  assert.match(quality, new RegExp(`"${requirement}"`))
}
assert.match(quality, /getSeoQualityDashboard/)
assert.match(quality, /seoExcluded/)
assert.match(quality, /SEO_LOCAL_THRESHOLDS/)

const adminSeo = await source("app/admin/seo/page.tsx")
assert.match(adminSeo, /Kontrola jakości SEO/)
assert.match(adminSeo, /IndexNow/)
assert.match(adminSeo, /setSeoExcludedAction/)
assert.match(adminSeo, /submitSeoSnapshotToIndexNowAction/)
const adminSeoActions = await source("app/admin/seo/actions.ts")
assert.match(adminSeoActions, /seo_excluded/)
assert.match(adminSeoActions, /submitIndexNowForAttractionId/)
assert.match(adminSeoActions, /submitIndexNowSeoSnapshot/)

const supplyActions = await source("app/admin/supply/actions.ts")
assert.match(supplyActions, /submitIndexNowForAttractionId/)
const onboardingComplete = await source("app/host/onboarding/gotowe/page.tsx")
assert.match(onboardingComplete, /submitIndexNowForAttractionId/)

const middleware = await source("middleware.ts")
assert.match(middleware, /X-Robots-Tag/)
assert.match(middleware, /noindex, nofollow, noarchive/)
assert.match(middleware, /seo_excluded/)
assert.match(middleware, /noindex, follow, noarchive/)
assert.match(middleware, /CRAWLER_USER_AGENT/)

console.log("SEO contracts: OK")
