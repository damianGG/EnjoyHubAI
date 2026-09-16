# EnjoyHub transactional email

## Architecture

There are two delivery paths on purpose:

1. **Supabase Auth + Resend SMTP** — account confirmation and password recovery keep the existing Supabase Auth rate limits and security flow. The branded source templates live in:
   - `supabase/templates/confirmation.html`
   - `supabase/templates/recovery.html`
2. **EnjoyHub application outbox + Resend API** — all business/product transactional messages are rendered by Next.js, written to the durable Supabase outbox first, and only then delivered through Resend:
   - organization/team invitation,
   - paid booking/ticket confirmation,
   - Demand availability notification,
   - verified-visit review invitation.

The application path is deliberately queue-first. A temporary Resend/network failure must not lose a paid-order confirmation or any other product e-mail.

## Durable outbox

The source of truth is:

- `email_outbox` — one durable message record with rendered HTML/text, recipients, status, retry state and provider message ID,
- `email_outbox_attempts` — delivery-attempt history.

Lifecycle:

```text
pending -> processing -> sent
                   \-> pending (retry)
                   \-> failed (after max attempts)
```

Default retry sequence is approximately:

1. immediate/next worker run,
2. +1 minute,
3. +5 minutes,
4. +15 minutes,
5. +60 minutes,
6. terminal `failed` after the configured maximum attempt count (default 5 attempts total).

A stale `processing` lease older than 10 minutes is automatically recovered so a crashed worker cannot permanently lock a message.

Each business event uses a stable dedupe key where appropriate, for example `order-confirmation:<order-id>`. Duplicate Stripe webhook delivery therefore resolves to the existing outbox record instead of creating a second confirmation e-mail.

## Worker and scheduling

Supabase Cron invokes:

```text
POST https://www.enjoyhub.app/api/email/outbox/process
```

every minute. The request is authenticated by a dedicated random worker token stored in **Supabase Vault**. The token is not exposed to the browser or stored as a `NEXT_PUBLIC_*` variable.

The Next.js worker:

1. verifies the Vault-backed worker token through a service-role-only RPC,
2. atomically claims due records using `FOR UPDATE SKIP LOCKED`,
3. sends them through the existing Resend client,
4. records provider result, duration and provider message ID,
5. schedules retry or marks the message terminal,
6. synchronizes source state for flows such as Demand notifications and review invitations.

Critical synchronous flows (for example a paid booking confirmation and a team invitation) still attempt delivery immediately after the message is safely persisted. If that immediate attempt fails, the same record remains queued for the worker.

## Admin operations

`/admin/email` is available only to active platform roles:

- `platform_superadmin`,
- `platform_support`.

The dashboard shows the latest outbox entries, status, message type/subject, recipient, attempt count, next retry, Resend message ID and last delivery error. It deliberately does not render full HTML message bodies in the list.

`Wyślij ponownie` creates a new outbox record linked through `resend_of_id`; the original row remains unchanged as an audit trail. The resend is attempted immediately and remains durable if the provider is unavailable.

## Runtime variables for Next.js/Vercel

```env
RESEND_API_KEY=re_...
EMAIL_FROM=EnjoyHub <hello@enjoyhub.app>
EMAIL_REPLY_TO=
EMAIL_SITE_URL=https://your-canonical-app-host.example
```

`RESEND_API_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_` variable.

When `EMAIL_SITE_URL` is empty, transactional links use `NEXT_PUBLIC_SITE_URL`, then the Vercel production/deployment URL.

No additional Vercel secret is needed for the outbox worker because its authentication secret is generated and held by Supabase Vault.

## Hosted Supabase Auth templates

The hosted Supabase project does not read `supabase/templates/*.html` from GitHub automatically. Keep these files as the source of truth and copy them to **Supabase Dashboard → Authentication → Emails → Templates** (or deploy them through the Supabase Management API when that credential is available).

Set:

- **Confirm signup subject:** `Potwierdź konto w EnjoyHub`
- **Confirm signup HTML:** contents of `supabase/templates/confirmation.html`
- **Reset password subject:** `Ustaw nowe hasło w EnjoyHub`
- **Reset password HTML:** contents of `supabase/templates/recovery.html`

The templates intentionally use `{{ .ConfirmationURL }}` so the currently working signup/recovery callback behavior is preserved.

## Deliverability rules

- Auth messages stay transactional and contain one primary CTA.
- Do not add marketing offers to confirmation/recovery emails.
- Keep Resend click/open tracking disabled for Auth messages so single-use Supabase links are not rewritten.
- Keep SPF and DKIM valid on the sending domain and configure DMARC.
- Use a stable verified From address.
- Do not send a whole email as one image; the template must remain useful with images blocked.

## Failure behavior

Email delivery must not roll back business actions:

- a valid team invitation remains valid if Resend is temporarily unavailable; the organizer still sees the copyable invitation URL and the e-mail remains queued,
- successful Stripe fulfillment remains successful if immediate confirmation delivery fails; the persisted outbox record is retried,
- Demand/review state is marked delivered only after the provider accepts the message,
- duplicate business events reuse the same deduped message rather than sending duplicates,
- terminal failures stay visible in `/admin/email` and can be manually resent by platform support.
