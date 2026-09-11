# Organizer operational dashboard

Point 9 of the organizer refactor turns `/host` from a launcher of disconnected cards into the organizer's daily operating screen.

## Purpose

The dashboard answers four questions immediately:

1. What is happening today?
2. What sold recently?
3. What starts next?
4. What requires the organizer's attention?

It is deliberately role-aware. Financial data is visible only to organizer sales roles, while cashier accounts keep a scanner-focused experience.

## Main sections

- today and 30-day sales metrics for sales roles;
- today's scheduled entries and the next six sessions;
- live remaining capacity for the next sessions via `ticketing_get_session_availability`;
- recent paid/pending orders;
- active attractions with the number of active offers;
- readiness tasks such as missing organization verification, missing offers or missing upcoming availability;
- organization verification/payment readiness;
- quick actions for attractions, offers, calendar, sales, verification and QR scanning;
- compact role-aware navigation across the organizer area.

## Access rules

The dashboard continues to derive permissions from `organization_memberships`:

- owner/admin/manager: management, sales and scanner views;
- viewer: sales read-only metrics and orders, without management actions;
- cashier: operational schedule/scanner context without financial results.

No global `users.is_host` flag is used as the authorization source.

## Data windows

The dashboard intentionally keeps the initial query bounded:

- orders: latest 30 days, up to 100 rows;
- sessions: from the previous 24 hours through the next 14 days, up to 500 rows;
- live availability RPC: only the next six sessions.

The dedicated sales and availability pages remain the detailed views.
