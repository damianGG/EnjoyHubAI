-- Run after all ticketing migrations on staging. The transaction is rolled
-- back, so the test does not leave organizations, orders or sessions behind.
-- At least one Auth user must already exist in the staging project.

begin;

do $atomic_ticketing_checkout_smoke$
declare
  test_user_id uuid;
  test_organization_id uuid := gen_random_uuid();
  test_venue_id uuid := gen_random_uuid();
  test_product_id uuid := gen_random_uuid();
  test_ticket_type_id uuid := gen_random_uuid();
  primary_session_id uuid := gen_random_uuid();
  release_session_id uuid := gen_random_uuid();
  primary_checkout_key uuid := gen_random_uuid();
  test_slug_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  test_items jsonb;
  first_checkout record;
  retried_checkout record;
  availability record;
  released_checkout record;
  generated_count integer;
  generated_again_count integer;
  oversell_blocked boolean := false;
  generation_date date := current_date + 60;
begin
  select id
    into test_user_id
    from auth.users
   order by created_at
   limit 1;

  if test_user_id is null then
    raise exception 'Stage 1B smoke test requires at least one Auth user';
  end if;

  insert into public.organizations (id, name, created_by)
  values (test_organization_id, 'Stage 1B Smoke Test', test_user_id);

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
    'Stage 1B Test Venue',
    'stage-1b-venue-' || test_slug_suffix,
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
    'Stage 1B Test Product',
    'stage-1b-product-' || test_slug_suffix,
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
    capacity_units
  ) values (
    test_ticket_type_id,
    test_product_id,
    'Bilet rodzinny',
    120,
    'PLN',
    3
  );

  insert into public.sessions (
    id,
    product_id,
    starts_at,
    ends_at,
    capacity
  ) values
    (
      primary_session_id,
      test_product_id,
      now() + interval '30 days',
      now() + interval '30 days 1 hour',
      4
    ),
    (
      release_session_id,
      test_product_id,
      now() + interval '31 days',
      now() + interval '31 days 1 hour',
      4
    );

  test_items := jsonb_build_array(jsonb_build_object(
    'ticket_type_id', test_ticket_type_id,
    'quantity', 1
  ));

  select *
    into first_checkout
    from public.ticketing_create_order_hold(
      primary_checkout_key,
      primary_session_id,
      'Jan Kowalski',
      'jan.kowalski@example.com',
      test_items,
      test_user_id,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      jsonb_build_object('test', true)
    );

  select *
    into retried_checkout
    from public.ticketing_create_order_hold(
      primary_checkout_key,
      primary_session_id,
      'Jan Kowalski',
      'jan.kowalski@example.com',
      test_items,
      test_user_id,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      jsonb_build_object('test', true)
    );

  if retried_checkout.created_order_id <> first_checkout.created_order_id then
    raise exception 'Idempotent retry created another order';
  end if;

  begin
    perform public.ticketing_create_order_hold(
      gen_random_uuid(),
      primary_session_id,
      'Anna Nowak',
      'anna.nowak@example.com',
      test_items,
      null,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      '{}'::jsonb
    );
  exception
    when others then
      if sqlstate = 'P0001'
         and position('Insufficient capacity' in sqlerrm) > 0 then
        oversell_blocked := true;
      else
        raise;
      end if;
  end;

  if not oversell_blocked then
    raise exception 'Checkout allowed capacity to be oversold';
  end if;

  select *
    into availability
    from public.ticketing_get_session_availability(primary_session_id);

  if availability.reserved_capacity_units <> 3
     or availability.available_capacity_units <> 1 then
    raise exception 'Active hold is not reflected in session availability';
  end if;

  perform public.ticketing_confirm_order(
    first_checkout.created_order_id,
    first_checkout.created_hold_token,
    jsonb_build_object('provider', 'smoke-test')
  );

  -- Payment webhooks are retried in practice; a second confirmation must not
  -- fail or consume capacity twice.
  perform public.ticketing_confirm_order(
    first_checkout.created_order_id,
    first_checkout.created_hold_token,
    jsonb_build_object('provider', 'smoke-test')
  );

  select *
    into released_checkout
    from public.ticketing_create_order_hold(
      gen_random_uuid(),
      release_session_id,
      'Ewa Testowa',
      'ewa.testowa@example.com',
      test_items,
      null,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      '{}'::jsonb
    );

  perform public.ticketing_release_order_hold(
    released_checkout.created_order_id,
    released_checkout.created_hold_token
  );

  select *
    into availability
    from public.ticketing_get_session_availability(release_session_id);

  if availability.reserved_capacity_units <> 0
     or availability.available_capacity_units <> 4 then
    raise exception 'Released hold still consumes session capacity';
  end if;

  insert into public.product_schedules (
    product_id,
    weekday,
    local_start_time,
    local_end_time,
    slot_interval_minutes,
    capacity,
    valid_from,
    valid_until
  ) values (
    test_product_id,
    extract(isodow from generation_date)::integer,
    '10:00',
    '12:00',
    30,
    8,
    generation_date,
    generation_date
  );

  generated_count := public.ticketing_generate_sessions(
    test_product_id,
    generation_date,
    generation_date
  );
  generated_again_count := public.ticketing_generate_sessions(
    test_product_id,
    generation_date,
    generation_date
  );

  if generated_count <> 3 or generated_again_count <> 0 then
    raise exception 'Session generation is not idempotent';
  end if;

  if has_function_privilege(
    'anon',
    'public.ticketing_create_order_hold(uuid,uuid,text,text,jsonb,uuid,text,public.ticketing_order_source,integer,boolean,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute the checkout write function';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.ticketing_create_order_hold(uuid,uuid,text,text,jsonb,uuid,text,public.ticketing_order_source,integer,boolean,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute the checkout write function';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.ticketing_create_order_hold(uuid,uuid,text,text,jsonb,uuid,text,public.ticketing_order_source,integer,boolean,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute the checkout write function';
  end if;
end
$atomic_ticketing_checkout_smoke$;

rollback;
