# EnjoyHub monitoring

## Where to look

### Sentry — primary incident view
Use **Issues** for grouped production errors. Each issue shows the stack trace, affected route/runtime, environment, release and EnjoyHub tags such as `area`, `operation`, `route` and `request_id`.

Use **Performance** for sampled traces. The initial sample rate is 5% and is configurable with `SENTRY_TRACES_SAMPLE_RATE` and `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.

Use **Crons / Monitors** for scheduled jobs. EnjoyHub reports check-ins for:

- `enjoyhub-email-outbox` — every minute,
- `enjoyhub-ticketing-cleanup` — `0 3 * * *`,
- `enjoyhub-settlement-release` — `0 4 * * *`,
- `enjoyhub-demand-notifications` — `15 7 * * *`,
- `enjoyhub-review-invitations` — `0 8 * * *`.

All schedules above are UTC. A missed check-in or HTTP 5xx run becomes a failed monitor after Sentry is connected.

### Vercel Runtime Logs
Use Vercel Runtime Logs for request-by-request diagnostics and structured JSON logs. Responses carry an `x-request-id`; server monitoring attaches the same correlation identifier where available.

### Health endpoint
`GET /api/health` checks the Next.js runtime and a minimal Supabase query. It returns HTTP 200 when both are healthy and HTTP 503 when the database check fails. The response contains environment/release metadata but no secrets or customer data and is intentionally uncached.

## Critical coverage

Sentry receives explicit errors from caught-error paths in addition to uncaught Next.js errors:

- checkout order creation and legal acceptance persistence,
- Stripe payment fulfillment and unexpected paid-but-unfulfilled states,
- Stripe Connect account/payout webhook processing and failed organizer payouts,
- transactional e-mail outbox worker,
- Demand notification processing,
- review invitation processing,
- ticketing cleanup,
- marketplace settlement release.

Expected business outcomes such as validation errors, sold-out capacity, rate limiting and invalid webhook signatures are not reported as incidents.

## Privacy defaults

Sentry uses `sendDefaultPii: false` and Session Replay is disabled in V1.

Before sending an event, the application removes:

- e-mail, username and IP fields from the Sentry user object,
- request cookies and headers,
- request body,
- URL query strings and fragments.

Business monitoring should use internal IDs and operational states only. Do not attach customer names, e-mail addresses, phone numbers, card data, webhook bodies or raw query strings to Sentry events.

## Required Sentry/Vercel configuration

Runtime ingestion:

```env
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.05
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05
```

Readable production source maps additionally require build-only credentials:

```env
SENTRY_ORG=...
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
```

`SENTRY_AUTH_TOKEN` must remain server/build-only and must never use the `NEXT_PUBLIC_` prefix.

## Recommended alert policy

Start with low-noise alerts:

1. notify on a new production issue,
2. notify immediately for `area=payments`, `area=checkout` and `operation=organizer_payout_failed`,
3. notify on terminal e-mail outbox failures,
4. notify when any cron monitor misses a check-in or finishes with error,
5. monitor `/api/health` and alert on non-2xx,
6. add 5xx rate/volume alerts after a few days of baseline traffic.

## Release/source maps

`withSentryConfig` is enabled in `next.config.mjs`. When `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` are configured during a Vercel build, Sentry can upload source maps so minified production stack traces resolve to the original TypeScript/React source.

Without a DSN the Sentry SDK stays disabled and sends no telemetry, so the monitoring code can be deployed safely before the external Sentry project is connected.
