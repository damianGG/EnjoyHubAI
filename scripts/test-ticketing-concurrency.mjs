import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.ALLOW_TICKETING_CONCURRENCY_TEST !== "true") {
  throw new Error(
    "Set ALLOW_TICKETING_CONCURRENCY_TEST=true only for an isolated staging project.",
  );
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const organizationId = randomUUID();
const venueId = randomUUID();
const productId = randomUUID();
const ticketTypeId = randomUUID();
const sessionId = randomUUID();
const checkoutKeys = [randomUUID(), randomUUID()];

async function requireSuccess(label, operation) {
  const result = await operation;
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function cleanup() {
  await supabase.from("inventory_holds").delete().eq("session_id", sessionId);
  await supabase.from("order_items").delete().eq("session_id", sessionId);
  await supabase.from("orders").delete().eq("venue_id", venueId);
  await supabase.from("sessions").delete().eq("id", sessionId);
  await supabase.from("ticket_types").delete().eq("product_id", productId);
  await supabase.from("products").delete().eq("id", productId);
  await supabase.from("venues").delete().eq("id", venueId);
  await supabase.from("organizations").delete().eq("id", organizationId);
}

try {
  const users = await requireSuccess(
    "List staging Auth users",
    supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
  );
  const testUser = users.users[0];

  if (!testUser) {
    throw new Error("The staging project needs at least one Auth user.");
  }

  await requireSuccess(
    "Create organization",
    supabase.from("organizations").insert({
      id: organizationId,
      name: "Stage 1B Concurrency Test",
      created_by: testUser.id,
    }),
  );
  await requireSuccess(
    "Create venue",
    supabase.from("venues").insert({
      id: venueId,
      organization_id: organizationId,
      name: "Concurrency Test Venue",
      slug: `concurrency-venue-${suffix}`,
      timezone: "Europe/Warsaw",
      sales_mode: "allocated_quota",
      status: "active",
      created_by: testUser.id,
    }),
  );
  await requireSuccess(
    "Create product",
    supabase.from("products").insert({
      id: productId,
      venue_id: venueId,
      name: "Concurrency Test Product",
      slug: `concurrency-product-${suffix}`,
      duration_minutes: 60,
      inventory_mode: "allocated_quota",
      status: "active",
      created_by: testUser.id,
    }),
  );
  await requireSuccess(
    "Create ticket type",
    supabase.from("ticket_types").insert({
      id: ticketTypeId,
      product_id: productId,
      name: "Family",
      price_amount: 120,
      currency: "PLN",
      capacity_units: 3,
    }),
  );

  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  await requireSuccess(
    "Create session",
    supabase.from("sessions").insert({
      id: sessionId,
      product_id: productId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: 4,
    }),
  );

  const checkout = (checkoutKey, email) =>
    supabase.rpc("ticketing_create_order_hold", {
      p_checkout_key: checkoutKey,
      p_session_id: sessionId,
      p_customer_name: "Concurrency Test",
      p_customer_email: email,
      p_items: [{ ticket_type_id: ticketTypeId, quantity: 1 }],
      p_customer_user_id: null,
      p_customer_phone: null,
      p_source: "enjoyhub_marketplace",
      p_hold_minutes: 15,
      p_terms_accepted: true,
      p_metadata: { test: true },
    });

  const results = await Promise.all([
    checkout(checkoutKeys[0], "concurrency-one@example.com"),
    checkout(checkoutKeys[1], "concurrency-two@example.com"),
  ]);

  const successful = results.filter((result) => !result.error);
  const rejected = results.filter((result) => result.error);
  if (successful.length !== 1 || rejected.length !== 1) {
    throw new Error(
      `Expected one accepted and one rejected checkout; got ${successful.length} accepted and ${rejected.length} rejected.`,
    );
  }

  if (!rejected[0].error.message.includes("Insufficient capacity")) {
    throw new Error(`Unexpected rejection: ${rejected[0].error.message}`);
  }

  const orders = await requireSuccess(
    "Count resulting orders",
    supabase
      .from("orders")
      .select("id, checkout_key")
      .in("checkout_key", checkoutKeys),
  );
  const holds = await requireSuccess(
    "Count resulting holds",
    supabase
      .from("inventory_holds")
      .select("id, capacity_units, status")
      .eq("session_id", sessionId),
  );

  if (orders.length !== 1 || holds.length !== 1 || holds[0].capacity_units !== 3) {
    throw new Error("Concurrent checkout left an invalid number of orders or holds.");
  }

  console.log(
    JSON.stringify(
      {
        result: "passed",
        acceptedCheckoutKey: orders[0].checkout_key,
        rejectedReason: rejected[0].error.message,
        sessionCapacity: 4,
        reservedCapacity: holds[0].capacity_units,
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
}
