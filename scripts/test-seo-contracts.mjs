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
  "components/seo/marketplace-landing.tsx",
  "lib/seo/attraction.ts",
  "lib/seo/landings.ts",
  "supabase/migrations/20260916155824_programmatic_local_seo.sql",
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
assert.match(attractionPage, /aria-label="Okruszki"/)
assert.doesNotMatch(attractionPage, /\.from\("properties"\)/)

const landingSeo = await source("lib/seo/landings.ts")
assert.match(landingSeo, /SEO_CITY_MIN_OBJECTS = 3/)
assert.match(landingSeo, /SEO_CITY_CATEGORY_MIN_OBJECTS = 2/)
assert.match(landingSeo, /marketplace_seo_catalog_v1/)
assert.match(landingSeo, /marketplace_seo_landing_v1/)
assert.match(landingSeo, /getSeoLandingPath/)
assert.match(landingSeo, /CollectionPage/)
assert.match(landingSeo, /ItemList/)
assert.match(landingSeo, /BreadcrumbList/)

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

const middleware = await source("middleware.ts")
assert.match(middleware, /X-Robots-Tag/)
assert.match(middleware, /noindex, nofollow, noarchive/)

console.log("SEO contracts: OK")
