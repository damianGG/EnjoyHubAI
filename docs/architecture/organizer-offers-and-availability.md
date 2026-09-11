# Organizer: offers and availability

This document defines the organizer-facing model used by EnjoyHub.

## Commercial hierarchy

The UI and domain language should consistently use this hierarchy:

`Organization → Venue → Attraction → Offer → Ticket type`

- **Organization** — the business/legal operator and permission boundary.
- **Venue** — the physical/operational location. It remains mostly technical in the first-time UX.
- **Attraction** — the public marketplace page a customer discovers, e.g. “Park Trampolin Rzeszów”.
- **Offer** (`products`) — exactly what the customer books, e.g. “Wejście 60 minut”, “Urodziny 2 godziny” or “Karnet całodniowy”. One attraction may expose multiple offers.
- **Ticket type** (`ticket_types`) — a price/eligibility variant inside one offer, e.g. normal, reduced, child or family. A ticket type can consume one or more capacity units.

Do not use attraction and offer as synonyms in customer or organizer copy.

## Capacity

Capacity belongs to a concrete visit/session of an offer. Ticket variants consume that capacity through `capacity_units`.

Examples:

- normal ticket: 1 unit,
- reduced ticket: 1 unit,
- family ticket for 4 people: 4 units.

`allocated_quota` means the session capacity is only the quota reserved for EnjoyHub. `native_enjoyhub` means EnjoyHub is the source of truth for the full capacity.

## Availability

Organizers should not manually maintain a list of dates for the next 90 days.

The source of truth is:

1. `product_schedules` — recurring weekly rules in the venue timezone,
2. `product_schedule_exceptions` — per-date closures or overrides,
3. `sessions` — concrete inventory materialized from the rules for checkout.

Concrete sessions are an implementation detail and rolling cache of sellable inventory. `ticketing_extend_active_sessions` keeps the future horizon populated automatically.

### Exceptions

A date exception can:

- close the offer for one date,
- override opening/start window for one date,
- override capacity for one date,
- combine special hours and special capacity.

Changing a date must never silently rewrite a session already referenced by checkout/order inventory. `ticketing_set_schedule_exception` and `ticketing_clear_schedule_exception` therefore refuse automatic rematerialization when a concrete session on the selected date has an order item or inventory hold.

## UX rule

First-time onboarding captures only one simple offer, one ticket type and one weekly availability rule. After publication, the organizer can add more offers/ticket variants and manage date exceptions from the panel.

The organizer-facing sections should be separate:

- **Oferty i cennik** — what is sold and for how much,
- **Kalendarz i dostępność** — when it can be bought/visited and how many places are available.

This separation is intentional and should be preserved when the organizer dashboard is redesigned.
