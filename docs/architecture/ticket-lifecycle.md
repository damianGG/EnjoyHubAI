# End-to-end ticket lifecycle

Point 11 closes the operational path from checkout to admission.

## Canonical flow

1. Buyer chooses an active offer, session and ticket variants.
2. `ticketing_create_order_hold` creates an idempotent order and reserves capacity for a short period.
3. Payment preparation extends the hold and creates one Stripe payment attempt.
4. Stripe Checkout is created with the order/payment-attempt identifiers in metadata.
5. A signed Stripe webhook is the authority that confirms settled funds.
6. `ticketing_confirm_provider_payment` atomically marks the order paid/confirmed, converts inventory and issues admission tickets.
7. Every ticket receives its own UUID `ticket_code` and QR URL.
8. The buyer sees the tickets immediately after payment and, for logged-in purchases, in `Moje bilety i zamówienia`.
9. Sales roles see the order lifecycle in `/host/sprzedaz/zamowienie/[orderId]`.
10. Entrance staff scan the QR in `/host/skaner` (built-in camera where supported, system-camera/manual fallback otherwise).
11. `ticketing_redeem_ticket` atomically changes `valid -> used`, storing `used_at` and `used_by`.
12. A second scan never admits twice: the RPC returns the original used state with `ticket_was_already_used=true`.

## Role boundary

Order/customer/payment information is available to:

- owner
- admin
- manager
- viewer
- the customer who owns the order

`cashier` / `Obsługa wejścia` deliberately does **not** receive generic access to order/customer/payment rows. Cashiers can inspect the bearer ticket page and redeem tickets only through the dedicated, organization-scoped redemption RPC.

This separation is enforced in database policies, not only in the UI.

## Organizer order lifecycle screen

The bounded RPC `ticketing_get_organizer_order_lifecycle(order_id)` supplies:

- order and payment state;
- customer contact data;
- purchased ticket variants and session;
- issued ticket states (`valid`, `used`, `void`);
- entrance timestamp and employee who redeemed the ticket;
- payment-attempt history.

The RPC checks the caller's organization role before returning any customer data.

## Scanner

The organizer scanner supports three levels:

1. in-browser camera with native `BarcodeDetector` when the browser supports it;
2. the phone's system camera opening the QR URL;
3. manual UUID/full-ticket-URL entry as an emergency fallback.

The QR is never the authority for admission. The server validates the logged-in employee, organization membership and current ticket state before redemption.

## Transactional self-test

The database lifecycle was exercised against an existing active session using a self-test contained in a rolled-back PL/pgSQL subtransaction:

- hold created;
- payment prepared and provider checkout attached;
- provider payment confirmed;
- order became `confirmed` + `paid`;
- one ticket was issued;
- organizer lifecycle returned that ticket;
- first redeem returned `used` and `alreadyUsed=false`;
- second redeem returned `used` and `alreadyUsed=true`.

A separate rolled-back role-boundary test confirmed that a cashier can redeem an organization ticket while `ticketing_can_read_order` returns false for that same cashier. Test rows and temporary membership were not persisted.

## Deferred to later roadmap items

- automatic ticket/confirmation email delivery belongs to point 13 (notifications);
- commissions, settlements, refunds and payouts belong to point 12.
