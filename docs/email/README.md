# EnjoyHub transactional email

## Architecture

There are two delivery paths on purpose:

1. **Supabase Auth + Resend SMTP** — confirmation and password recovery keep the existing Supabase Auth rate limits and security flow. The branded source templates live in:
   - `supabase/templates/confirmation.html`
   - `supabase/templates/recovery.html`
2. **EnjoyHub application + Resend API** — transactional product messages sent by Next.js:
   - organization/team invitation,
   - paid booking/ticket confirmation.

Both paths use HTML that is deliberately text-first, mobile friendly and compatible with common email clients. Every app-sent message also includes a plain-text body.

## Runtime variables for Next.js/Vercel

```env
RESEND_API_KEY=re_...
EMAIL_FROM=EnjoyHub <hello@enjoyhub.app>
EMAIL_REPLY_TO=
EMAIL_SITE_URL=https://your-canonical-app-host.example
```

`RESEND_API_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_` variable.

When `EMAIL_SITE_URL` is empty, transactional links use `NEXT_PUBLIC_SITE_URL`, then the Vercel production/deployment URL.

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

- a valid team invitation remains valid if Resend is temporarily unavailable; the organizer still sees the copyable invitation URL,
- successful Stripe fulfillment remains successful if the confirmation email fails,
- duplicate Stripe webhook events do not send a duplicate booking confirmation.
