# Organizer team and permissions

Point 10 introduces organization-scoped team management. A person keeps one EnjoyHub account and receives a role only inside a selected organization.

## Roles

- `owner` — full access, team management, legal/verification data, can grant ownership.
- `admin` — operational administration and team management, but cannot manage owners or other admins and cannot grant ownership.
- `manager` — attractions, offers, availability, sales and scanner; no team management and no legal/verification data.
- `cashier` — entrance control / QR scanning only.
- `viewer` — read-only sales/results view.

## Invitations

Owners and admins create a seven-day invitation for one email address and one organization. The application returns a one-time raw token in the invitation URL; PostgreSQL stores only its SHA-256 hash. The invitation can be accepted only by an authenticated account whose email equals the invited address.

Automatic invitation email delivery is intentionally deferred to the notifications workstream. Until then the organizer copies and sends the generated link manually.

## Membership safety

Direct `INSERT`, `UPDATE` and `DELETE` privileges on `organization_memberships` are revoked from the authenticated role. Membership mutations go through security-definer RPCs that enforce the role matrix.

Important invariants:

- an organization can never be left without an owner;
- only an owner can grant ownership;
- admins cannot alter owners or administrators;
- a pending invitation does not grant access;
- invitations can be revoked before acceptance;
- legal verification remains owner/admin only.

## Main routes

- `/host/zespol` — members, roles and pending invitations;
- `/host/zespol/zaproszenie/[token]` — authenticated invitation acceptance;
- `/host/weryfikacja` — legal/payment verification restricted to owner/admin.
