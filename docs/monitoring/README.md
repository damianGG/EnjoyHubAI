# EnjoyHub monitoring

## Where to look

### Sentry — primary incident view
Use **Issues** for grouped production errors. Each issue should show the stack trace, route/runtime, environment, release and the tags added by EnjoyHub (`area`, `operation`, `route`, `request_id`).

Use **Performance** for sampled traces. The default sampling rate in this repository is 5% and can be changed with `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.

Use **Crons / Monitors** for scheduled jobs. EnjoyHub reports check-ins for:

- `enjoyhub-email-outbox` — every minute,
- `enjoyhub-ticketing-cleanup` — daily at 03:00 UTC,
- `enjoyhub-settlement-release` — daily at 04:00 UTC,
- `enjoyhub-demand-notifications` — daily at 07:15 UTC,
- `enjoyhub-review-invitations` — daily at 08:00 UTC.

A missed check-in or an HTTP 5xx result should be visible as a failed monitor after Sentry is connected.

### Vercel — raw runtime logs
Vercel Runtime Logs remain the quickest source for individual request logs. EnjoyHub emits JSON-formatted operational errors with an `area`, `operation` and `requestId`, so the same incident can be correlated with Sentry.

### Health endpoint
`GET /api/health` performs a minimal application + database liveness check and returns no secrets or customer data. It is intentionally uncached and can be used by an uptime monitor.

## Privacy defaults

Sentry is configured with `sendDefaultPii: false`.

Before an event is sent, the application removes:

- e-mail, username and IP fields from the Sentry user object,
- request cookies,
- request headers,
- request body,
- URL query strings and fragments.

Session Replay is disabled in V1. Do not enable Replay without a separate privacy/legal review and masking policy.

Business monitoring must use internal IDs and operational states only. Do not attach customer names, e-mail addresses, phone numbers, card data, webhook bodies or raw query strings to Sentry events.

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

Readable production source maps additionally require build credentials:

```env
SENTRY_ORG=...
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
```

`SENTRY_AUTH_TOKEN` is a server/build secret and must never use the `NEXT_PUBLIC_` prefix.

## Recommended alerts

Create high-priority notifications for:

1. any new production issue tagged `area=payments` or `area=checkout`,
2. `operation=organizer_payout_failed`,
3. terminal e-mail outbox failures,
4. any failed or missed cron monitor,
5. `/api/health` returning non-2xx,
6. a sustained increase in production 5xx errors.

Lower-priority issues can be reviewed as grouped Sentry Issues instead of generating a notification for every occurrence.

## Release/source maps

`withSentryConfig` is enabled in `next.config.mjs`. When `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` are configured during a Vercel build, Sentry can upload source maps so minified production stack traces resolve to the original TypeScript/React source.

Without a DSN the Sentry SDK stays disabled and does not send telemetry. This allows the code to deploy safely before the external Sentry project is connected.
