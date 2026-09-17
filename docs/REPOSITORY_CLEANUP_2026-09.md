# Repository cleanup — September 2026

Status: in progress  
Working branch: `chore/repository-cleanup`  
Baseline commit: `569bfd500ab83cfa21d0ee7b96511a4339e7dedd`  
Safety snapshot: `snapshot/pre-cleanup-2026-09-17`

## Goal

Remove legacy code and duplicated implementations without changing the active ticketing, host, checkout, SEO, or marketplace flows. Database objects are not deleted until every application caller has been checked.

## Execution phases

### Phase A — baseline and safe dead-code cleanup

- [x] Create dedicated cleanup branch.
- [x] Create immutable-in-practice snapshot branch for the pre-cleanup commit (GitHub connector does not expose tag creation).
- [x] Identify the existing quality pipeline (`lint`, `typecheck`, contract tests, production build).
- [x] Remove duplicate `components/ui/use-mobile.tsx`; active code imports `@/hooks/use-mobile`.
- [x] Remove duplicate `components/ui/use-toast.ts`; active code imports `@/hooks/use-toast`.
- [x] Remove unused `components/ticketing/organizer-onboarding-wizard.tsx`; `/host/onboarding` uses `OrganizerOnboardingLite`.
- [x] Remove unused `components/category-management.tsx`; `/admin/categories` uses `CategoryManagementEnhanced`.
- [ ] Run the repository quality workflow through a pull request.

### Phase B — legacy routing and booking model

- [ ] Inventory all public, customer, host and admin routes.
- [ ] Keep `/dashboard/bookings`: it is part of the current customer ticketing flow.
- [ ] Review `/offers/[id]`, `/widget/rezerwacja/[propertyId]`, `/bilety/[productId]`, `/checkout/*` and redirect wrappers before deleting anything.
- [ ] Inventory former `bookings` / availability code and prove it has no current callers before removal.
- [ ] Leave one canonical host onboarding flow and one canonical sales/ticketing flow.

### Phase C — database and migrations

- [ ] Treat `supabase/migrations/` as the migration source of truth.
- [ ] Audit numbered SQL files under `scripts/`; several are historical setup/mock/test scripts and must not be run against current production.
- [ ] Inventory tables, columns, functions, triggers and RLS policies against live Supabase.
- [ ] Do not drop database objects in this cleanup until application references and migration history are reconciled.
- [ ] Verify that a new database can be reproduced from canonical migrations and documented seed/test fixtures.

### Phase D — environment, Stripe and feature flags

- [ ] Compare environment variables used by code, `.env.example`, Vercel production and preview environments.
- [ ] Inventory Stripe checkout endpoints and webhooks; keep one canonical payment flow.
- [ ] Audit `TICKETING_CHECKOUT_ENABLED` and other flags; remove flags only after their alternative branch is proven obsolete.

### Phase E — dependencies, UI and repository structure

- [ ] Remove unused dependencies and duplicate libraries with lockfile updates in the same commit.
- [ ] Investigate deprecated `@supabase/auth-helpers-nextjs`; current source search finds it only in dependency metadata/documentation, while the project already uses `@supabase/ssr`.
- [ ] Review `hooks/` versus `lib/hooks/` conventions.
- [ ] Review `app/globals.css` versus `styles/globals.css` usage.
- [ ] Consolidate duplicated UI implementations only after import/route usage is proven.
- [ ] Review unused assets, placeholder files and obsolete component-level documentation.

### Phase F — documentation and GitHub hygiene

- [ ] Replace the minimal README with current setup and architecture guidance.
- [ ] Add/normalize canonical docs for architecture, database, booking flow, host onboarding and deployment.
- [ ] Move historical implementation summaries and completed PR checklists to `docs/archive/` or delete them where they add no durable value.
- [ ] Review stale branches, pull requests and issues after code cleanup is merged.

### Phase G — security and release verification

- [ ] Search repository history/current tree for accidental secrets.
- [ ] Audit admin/host authorization and Supabase RLS.
- [ ] Audit privileged RPC/functions and webhook authorization.
- [ ] Run security/performance advisors after any database changes.
- [ ] Verify registration, login, discovery, attraction page, date/session selection, checkout, payment, reservation, host onboarding, venue creation and host management.
- [ ] Require lint, typecheck, contract tests and production build to pass before merge.

## Baseline observations

### Production/deployment

The Vercel project linked to `damianGG/EnjoyHubAI` is `v0-enjoy-hub-new`. A READY production deployment exists, but the current repository HEAD was not the currently promoted production commit at audit start. Several newer builds were queued/rate-limited. Do not equate a Vercel build-rate-limit status with an application compilation failure.

### Existing production error to fix separately or before release

Vercel runtime monitoring reported repeated failures on `/attractions/[slug]`:

`Postgres 42703: column properties.region does not exist`

Live Supabase schema confirms `public.properties` has `city`, `country` and `city_slug`, but no `region` column. `lib/seo/attraction.ts` currently includes `region` in the `properties` select. The fix should align the query with the canonical schema rather than adding production schema opportunistically during repository cleanup.

### Legacy SQL

The numbered `scripts/*.sql` files describe the former `properties` / `bookings` setup and include mock/test/admin setup scripts. Existing repository documentation already warns that the former host-properties workflow is legacy. These files require archival/removal review; they are not canonical replacements for timestamped Supabase migrations.

## Rules for this cleanup

1. No database DROP statements without an explicit caller and migration audit.
2. No route deletion based only on naming; active links, redirects and SEO contracts must be checked.
3. No dependency removal without source-usage search and lockfile update.
4. Every cleanup batch must pass the existing GitHub quality workflow.
5. Production regressions discovered during cleanup are documented and fixed deliberately, not hidden inside unrelated deletions.
