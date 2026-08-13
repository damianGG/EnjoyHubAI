-- Run after the stage 1D migration. The transaction rolls back all test data.
-- At least one Auth user must exist in the staging project.

begin;

do $ticketing_payments_and_tickets_smoke$
declare
  test_user_id uuid;
  test_organization_id uuid := gen_random_uuid();
  test_venue_id uuid := gen_random_uuid();
  test_product_id uuid := gen_random_uuid();
  test_ticket_type_id uuid := gen_random_uuid();
  paid_session_id uuid := gen_random_uuid();
  expired_session_id uuid := gen_random_uuid();
  test_slug_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  test_items jsonb;
  paid_checkout record;
  expired_checkout record;
  prepared_payment record;
  prepared_expiry record;
  confirmed_payment record;
  duplicate_payment record;
  second_event_payment record;
  redeemed_ticket record;
  repeated_redemption record;
  closed_payment record;
  stored_state record;
  stored_ticket_count integer;
begin
  select id
    into test_user_id
    from auth.users
   order by created_at
   limit 1;

  if test_user_id is null then
    raise exception 'Stage 1D smoke test requires at least one Auth user';
  end if;

  insert into public.organizations (id, name, created_by)
  values (test_organization_id, 'Stage 1D Smoke Test', test_user_id);

  insert into public.venues (
    id,
    organization_id,
    name,
    slug,
    timezone,
    sales_mode,
    status,
    created_by
  ) values (
    test_venue_id,
    test_organization_id,
    'Stage 1D Test Venue',
    'stage-1d-venue-' || test_slug_suffix,
    'Europe/Warsaw',
    'allocated_quota',
    'active',
    test_user_id
  );

  insert into public.products (
    id,
    venue_id,
    name,
    slug,
    duration_minutes,
    inventory_mode,
    status,
    created_by
  ) values (
    test_product_id,
    test_venue_id,
    'Stage 1D Test Product',
    'stage-1d-product-' || test_slug_suffix,
    60,
    'allocated_quota',
    'active',
    test_user_id
  );

  insert into public.ticket_types (
    id,
    product_id,
    name,
    price_amount,
    currency,
    capacity_units,
    max_quantity_per_order
  ) values (
    test_ticket_type_id,
    test_product_id,
    'Bilet testowy',
    50,
    'PLN',
    1,
    10
  );

  insert into public.sessions (
    id,
    product_id,
    starts_at,
    ends_at,
    capacity
  ) values
    (
      paid_session_id,
      test_product_id,
      now() + interval '30 days',
      now() + interval '30 days 1 hour',
      10
    ),
    (
      expired_session_id,
      test_product_id,
      now() + interval '31 days',
      now() + interval '31 days 1 hour',
      10
    );

  test_items := jsonb_build_array(jsonb_build_object(
    'ticket_type_id', test_ticket_type_id,
    'quantity', 2
  ));

  select *
    into paid_checkout
    from public.ticketing_create_order_hold(
      gen_random_uuid(),
      paid_session_id,
      'Jan Testowy',
      'jan.stage1d@example.com',
      test_items,
      test_user_id,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      jsonb_build_object('test', 'stage-1d')
    );

  select *
    into prepared_payment
    from public.ticketing_prepare_payment_checkout(
      paid_checkout.created_order_id,
      paid_checkout.created_hold_token,
      'stripe',
      35
    );

  if prepared_payment.payment_amount_minor <> 10000
     or prepared_payment.payment_currency <> 'PLN'
     or prepared_payment.current_attempt_status <> 'creating'
     or prepared_payment.payment_hold_expires_at <= paid_checkout.hold_expires_at then
    raise exception 'Payment preparation returned an invalid snapshot';
  end if;

  select *
    into prepared_expiry
    from public.ticketing_attach_payment_checkout(
      prepared_payment.payment_attempt_id,
      prepared_payment.payment_attempt_token,
      'cs_test_stage_1d_paid',
      now() + interval '30 minutes'
    );

  if prepared_expiry.attached_attempt_status <> 'open' then
    raise exception 'Stripe Checkout Session was not attached';
  end if;

  select *
    into confirmed_payment
    from public.ticketing_confirm_provider_payment(
      'evt_stage_1d_paid',
      'checkout.session.completed',
      repeat('a', 64),
      prepared_payment.payment_attempt_id,
      'cs_test_stage_1d_paid',
      'pi_test_stage_1d_paid',
      10000,
      'pln',
      now(),
      jsonb_build_object('livemode', false)
    );

  if confirmed_payment.current_order_status <> 'confirmed'
     or confirmed_payment.current_payment_status <> 'paid'
     or confirmed_payment.issued_ticket_count <> 2
     or confirmed_payment.event_was_duplicate then
    raise exception 'Verified payment was not fulfilled correctly';
  end if;

  select *
    into duplicate_payment
    from public.ticketing_confirm_provider_payment(
      'evt_stage_1d_paid',
      'checkout.session.completed',
      repeat('a', 64),
      prepared_payment.payment_attempt_id,
      'cs_test_stage_1d_paid',
      'pi_test_stage_1d_paid',
      10000,
      'pln',
      now(),
      jsonb_build_object('livemode', false)
    );

  if not duplicate_payment.event_was_duplicate
     or duplicate_payment.issued_ticket_count <> 2 then
    raise exception 'Repeated Stripe event was not idempotent';
  end if;

  select *
    into second_event_payment
    from public.ticketing_confirm_provider_payment(
      'evt_stage_1d_paid_retry',
      'checkout.session.async_payment_succeeded',
      repeat('b', 64),
      prepared_payment.payment_attempt_id,
      'cs_test_stage_1d_paid',
      'pi_test_stage_1d_paid',
      10000,
      'pln',
      now(),
      jsonb_build_object('livemode', false)
    );

  select count(*)::integer
    into stored_ticket_count
    from public.tickets
   where order_id = paid_checkout.created_order_id;

  if second_event_payment.issued_ticket_count <> 2
     or stored_ticket_count <> 2 then
    raise exception 'A second success event issued duplicate tickets';
  end if;

  perform set_config('request.jwt.claim.sub', test_user_id::text, true);

  select *
    into redeemed_ticket
    from public.ticketing_redeem_ticket(
      (
        select ticket_code
        from public.tickets
        where order_id = paid_checkout.created_order_id
        order by sequence_number
        limit 1
      )
    );

  select *
    into repeated_redemption
    from public.ticketing_redeem_ticket(redeemed_ticket.redeemed_ticket_code);

  if redeemed_ticket.current_ticket_status <> 'used'
     or redeemed_ticket.ticket_was_already_used
     or redeemed_ticket.ticket_used_at is null
     or repeated_redemption.current_ticket_status <> 'used'
     or not repeated_redemption.ticket_was_already_used
     or repeated_redemption.ticket_used_at <> redeemed_ticket.ticket_used_at then
    raise exception 'Ticket redemption is not atomic and idempotent';
  end if;

  select
    customer_order.status as order_status,
    customer_order.payment_status,
    hold.status as hold_status,
    attempt.status as attempt_status
    into stored_state
    from public.orders customer_order
    join public.inventory_holds hold on hold.order_id = customer_order.id
    join public.payment_attempts attempt on attempt.order_id = customer_order.id
   where customer_order.id = paid_checkout.created_order_id;

  if stored_state.order_status <> 'confirmed'
     or stored_state.payment_status <> 'paid'
     or stored_state.hold_status <> 'converted'
     or stored_state.attempt_status <> 'paid' then
    raise exception 'Paid order lifecycle is inconsistent';
  end if;

  test_items := jsonb_build_array(jsonb_build_object(
    'ticket_type_id', test_ticket_type_id,
    'quantity', 1
  ));

  select *
    into expired_checkout
    from public.ticketing_create_order_hold(
      gen_random_uuid(),
      expired_session_id,
      'Ewa Testowa',
      'ewa.stage1d@example.com',
      test_items,
      null,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      '{}'::jsonb
    );

  select *
    into prepared_payment
    from public.ticketing_prepare_payment_checkout(
      expired_checkout.created_order_id,
      expired_checkout.created_hold_token,
      'stripe',
      35
    );

  perform public.ticketing_attach_payment_checkout(
    prepared_payment.payment_attempt_id,
    prepared_payment.payment_attempt_token,
    'cs_test_stage_1d_expired',
    now() + interval '30 minutes'
  );

  select *
    into closed_payment
    from public.ticketing_close_provider_payment(
      'evt_stage_1d_expired',
      'checkout.session.expired',
      repeat('c', 64),
      'cs_test_stage_1d_expired',
      'expired',
      'checkout_session_expired'
    );

  if closed_payment.closed_attempt_status <> 'expired'
     or closed_payment.closed_order_status <> 'expired'
     or closed_payment.event_was_duplicate then
    raise exception 'Expired Checkout Session was not closed correctly';
  end if;

  select
    customer_order.status as order_status,
    hold.status as hold_status
    into stored_state
    from public.orders customer_order
    join public.inventory_holds hold on hold.order_id = customer_order.id
   where customer_order.id = expired_checkout.created_order_id;

  if stored_state.order_status <> 'expired'
     or stored_state.hold_status <> 'expired' then
    raise exception 'Expired payment did not release inventory';
  end if;

  if has_table_privilege('anon', 'public.payment_attempts', 'SELECT')
     or has_table_privilege('anon', 'public.payment_webhook_events', 'SELECT')
     or has_table_privilege('anon', 'public.tickets', 'SELECT') then
    raise exception 'anon must not read payment or ticket internals';
  end if;

  if has_function_privilege(
    'anon',
    'public.ticketing_confirm_provider_payment(text,text,text,uuid,text,text,bigint,text,timestamptz,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.ticketing_confirm_provider_payment(text,text,text,uuid,text,text,bigint,text,timestamptz,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Browser roles must not execute payment fulfillment';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.ticketing_confirm_provider_payment(text,text,text,uuid,text,text,bigint,text,timestamptz,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute payment fulfillment';
  end if;

  if has_function_privilege(
    'anon',
    'public.ticketing_redeem_ticket(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.ticketing_redeem_ticket(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Only authenticated staff may execute ticket redemption';
  end if;
end
$ticketing_payments_and_tickets_smoke$;

rollback;
