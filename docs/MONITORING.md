# EnjoyHub monitoring

## Where to look

### Sentry
Use Sentry for grouped application errors, stack traces, affected routes, releases, performance traces and cron check-ins. The application deliberately does not enable Session Replay and strips request headers, cookies, request bodies, query strings and common user PII before sending events.

### Vercel Runtime Logs
Use Vercel Runtime Logs for request-by-request server diagnostics and structured JSON logs. Responses include an `x-request-id` header; server monitoring attaches the same correlation identifier where available.

### Health endpoint
`GET /api/health` checks the Next.js runtime and a minimal Supabase query. It returns HTTP 200 when both are healthy and HTTP 503 when the database check fails. The response contains environment/release metadata but no secrets or database data.

## Critical coverage

Sentry receives explicit errors from critical caught-error paths in addition to uncaught Next.js errors:

- checkout order creation and legal acceptance persistence,
- Stripe payment fulfillment and unexpected paid-but-unfulfilled states,
- Stripe Connect account/payout webhook processing and failed organizer payouts,
- transactional e-mail outbox worker,
- Demand notification processing,
- review invitation processing,
- ticketing cleanup,
- marketplace settlement release.

Expected user/business outcomes such as validation errors, sold-out capacity, rate limiting and invalid webhook signatures are not reported as incidents.

## Cron monitors

The following jobs emit Sentry check-ins after authentication succeeds:

- `enjoyhub-email-outbox` — every minute,
- `enjoyhub-ticketing-cleanup` — `0 3 * * *`,
- `enjoyhub-settlement-release` — `0 4 * * *`,
- `enjoyhub-demand-notifications` — `15 7 * * *`,
- `enjoyhub-review-invitations` — `0 8 * * *`.

All cron schedules above are UTC.

## Required Sentry configuration

Runtime event ingestion:

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ENVIRONMENT=production`
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production`

Recommended trace sample rate for initial production rollout:

- `SENTRY_TRACES_SAMPLE_RATE=0.05`
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05`

Readable production stack traces / source map uploads also require build-only configuration:

- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

Never expose `SENTRY_AUTH_TOKEN` through a `NEXT_PUBLIC_` variable.

## Recommended alert policy

Start with low-noise alerts:

1. notify on a new production issue,
2. notify immediately for tagged payment/checkout/settlement failures,
3. notify when a cron monitor misses its expected check-in or finishes with error,
4. add rate/volume alerts only after a few days of baseline traffic.

The monitoring SDK is safe to deploy before the DSN is configured: it stays disabled until a DSN is present.
