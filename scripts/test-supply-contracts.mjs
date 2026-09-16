import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const repositoryRoot = new URL("../", import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repositoryRoot), "utf8")
}

const migration = await source("supabase/migrations/20260916210956_global_supply_deduplication.sql")
const urlTighteningMigration = await source("supabase/migrations/20260916222050_tighten_supply_url_deduplication.sql")

for (const helper of [
  "supply_normalize_text",
  "supply_normalize_phone",
  "supply_normalize_url",
  "supply_url_domain",
  "supply_find_duplicate_lead",
  "supply_merge_lead_data",
  "supply_resolve_or_create_lead",
]) {
  assert.match(migration, new RegExp(`public\\.${helper}`), `Brakuje globalnego helpera Supply: ${helper}`)
}

for (const identity of [
  "external_id",
  "source_url",
  "website_location",
  "phone_city",
  "address_city",
  "name_geo",
  "name_city_consistent",
]) {
  assert.match(migration, new RegExp(`'${identity}'`), `Brakuje reguły deduplikacji: ${identity}`)
}

assert.match(migration, /supply_external_identities/)
assert.match(migration, /primary key \(source_provider, source_external_id\)/)
assert.match(migration, /generated always as \(public\.supply_normalize_text\(name\)\) stored/)
assert.match(migration, /generated always as \(public\.supply_normalize_phone\(phone\)\) stored/)
assert.match(migration, /generated always as \(public\.supply_normalize_url\(website_url\)\) stored/)
assert.match(migration, /pg_advisory_xact_lock\(hashtext\(v_lock_key\)\)/)
assert.match(migration, /platform_supply_create_lead\(p_data jsonb\)/)
assert.match(migration, /platform_supply_update_lead/)
assert.match(migration, /platform_supply_finish_discovery/)
assert.match(migration, /supply_resolve_or_create_lead\(candidate_data/)
assert.match(migration, /supply\.lead\.duplicate_resolved/)
assert.match(migration, /Supply lead would duplicate an existing lead/)
assert.match(migration, /Domain-only and phone-only matches are intentionally excluded/)

// URL identity must not collapse two known locations of the same chain/operator.
assert.match(urlTighteningMigration, /v_city is null\s+or lead\.dedupe_city_key is null\s+or lead\.dedupe_city_key = v_city/)
assert.match(urlTighteningMigration, /\(v_city is not null and lead\.dedupe_city_key = v_city\)/)
assert.match(urlTighteningMigration, /v_city is null\s+and v_name is not null\s+and lead\.dedupe_name_key = v_name/)
assert.doesNotMatch(urlTighteningMigration, /\(v_city is not null and lead\.dedupe_city_key = v_city\)\s+or \(v_name is not null and lead\.dedupe_name_key = v_name\)/)

// The old campaign-specific implementation used domain-only / phone-only candidate variables.
// Global resolver must be the single identity path instead.
assert.doesNotMatch(migration, /candidate_domain/)
assert.doesNotMatch(migration, /candidate_phone_key/)

process.stdout.write("Supply contracts OK\n")
