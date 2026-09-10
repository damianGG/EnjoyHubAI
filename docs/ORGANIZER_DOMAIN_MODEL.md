# EnjoyHub organizer domain model

Status: accepted for implementation on `feat/organizer-e2e`.

## Core rule

EnjoyHub has one identity per person. A person does not create a separate host account.

- `auth.users` = authentication identity.
- `public.users` = profile.
- Organizer access = membership in an organization.
- `public.users.is_host` is legacy and must not be used for authorization.
- `public.users.role` is only for global platform roles such as `super_admin`; organization roles live in `organization_memberships.role`.

A person may simultaneously be a customer and an organizer, and may belong to multiple organizations with different roles.

## Canonical hierarchy

```text
User
  └── Organization membership (owner/admin/manager/cashier/viewer)
        └── Organization
              └── Venue / obiekt
                    ├── Attraction / atrakcja
                    │     └── Product / oferta
                    │           ├── Ticket type / rodzaj biletu
                    │           ├── Schedule / reguła dostępności
                    │           └── Session / konkretny termin
                    └── staff access inherited from organization membership
```

### Organization

Business or operating entity: company, sole trader, foundation, etc. Stores legal and billing data. It is not a customer-facing attraction.

### Venue / obiekt

Physical branch/location operated by an organization. Address, coordinates, timezone and operational sales mode belong here.

One organization may operate many venues.

### Attraction / atrakcja

Customer-facing experience shown in discovery: paintball, go-karts, trampoline park, escape room, etc.

One venue may eventually expose multiple attractions. In the current storage model an attraction is still stored in the legacy `properties` table. Organizer code should use the term `attraction`; `property` is storage terminology only.

### Product / oferta

What the customer can book/buy for one attraction, e.g.:

- 60 min trampoline entry,
- paintball package for 10 people,
- family ticket,
- birthday package.

A product owns ticket types and availability rules/sessions.

## Transition from the legacy model

Current storage contains two overlapping models:

1. `properties` — older marketplace/discovery model owned by `host_id`.
2. `organizations -> venues -> products` — newer canonical ticketing model.

We migrate without a destructive table rename.

Phase 1:

- add `properties.venue_id`,
- add `products.attraction_id`,
- backfill both from the existing `venues.property_id` bridge,
- make organization membership the canonical organizer authorization source,
- change `properties.host_id` deletion behavior from cascade to set-null,
- expose `organizer_attractions` as an organizer-facing semantic read view,
- keep `venues.property_id` temporarily for compatibility.

Phase 2:

- switch organizer dashboard queries from `properties + host_id` to organization/venue-scoped attractions,
- stop writing/reading global `is_host` for business authorization,
- allow one venue to manage multiple attractions explicitly,
- remove legacy owner-facing `/properties` terminology and routes.

Phase 3, only after all callers are migrated:

- decide whether to rename the physical `properties` table to `attractions` or keep it as an internal storage name,
- remove `venues.property_id`, `properties.host_id`, `users.is_host` and the `host` value of the global user role if no longer referenced.

## Authorization rules

Organization membership is the source of truth:

- `owner`: full organization control and ownership transfer.
- `admin`: organization configuration and team management except ownership transfer.
- `manager`: venues, attractions, offers, schedules and operational sales management.
- `cashier`: entry validation/scanner only.
- `viewer`: read-only reporting/sales visibility.

An attraction must not disappear because the user who originally created it deletes their account. Business content belongs to the organization/venue.

## UI language

Use these words in customer/organizer UI:

- Organizacja / Firma
- Obiekt / Lokalizacja
- Atrakcja
- Oferta
- Bilet
- Termin

Do not expose `property`, `nieruchomość`, `venue_id`, `product_id`, or other storage terminology to normal organizers.

## Organizer onboarding target

The first organizer onboarding should create, in one transaction:

1. organization,
2. owner membership for the current account,
3. venue,
4. attraction,
5. first product,
6. ticket types,
7. availability/sessions.

After completion the same account remains usable as a normal customer. Returning organizers should enter the organizer dashboard, not create a second account.
