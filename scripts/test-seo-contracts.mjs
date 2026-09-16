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
  "lib/seo/attraction.ts",
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

const middleware = await source("middleware.ts")
assert.match(middleware, /X-Robots-Tag/)
assert.match(middleware, /noindex, nofollow, noarchive/)

console.log("SEO contracts: OK")
