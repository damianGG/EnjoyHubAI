import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)
const source = (path) => readFile(new URL(path, root), "utf8")

const [instrumentation, client, serverConfig, edgeConfig, health, monitoring, stripe, stripeConnect, checkout, outbox] = await Promise.all([
  source("instrumentation.ts"),
  source("instrumentation-client.ts"),
  source("sentry.server.config.ts"),
  source("sentry.edge.config.ts"),
  source("app/api/health/route.ts"),
  source("lib/monitoring/server.ts"),
  source("app/api/webhooks/stripe/route.ts"),
  source("app/api/webhooks/stripe/connect/route.ts"),
  source("app/api/ticketing/checkout/route.ts"),
  source("app/api/email/outbox/process/route.ts"),
])

assert.match(instrumentation, /captureRequestError/)
assert.match(client, /sendDefaultPii:\s*false/)
assert.match(client, /replaysSessionSampleRate:\s*0/)
assert.match(client, /request\.headers = undefined/)
assert.match(client, /request\.cookies = undefined/)
assert.match(serverConfig, /sendDefaultPii:\s*false/)
assert.match(edgeConfig, /sendDefaultPii:\s*false/)
assert.match(health, /checks:\s*\{ app: true, database: true \}/)
assert.match(monitoring, /captureCheckIn/)
assert.match(monitoring, /request_id/)
assert.match(stripe, /reportServerError/)
assert.match(stripeConnect, /organizer_payout_failed/)
assert.match(checkout, /create_order_hold/)
assert.match(outbox, /enjoyhub-email-outbox/)

for (const path of [
  "app/api/cron/demand-notifications/route.ts",
  "app/api/cron/review-invitations/route.ts",
  "app/api/cron/settlement-release/route.ts",
  "app/api/cron/ticketing-cleanup/route.ts",
]) {
  assert.match(await source(path), /runMonitoredCron/, `${path} must report cron check-ins`)
}

console.log("Monitoring contracts: OK")
