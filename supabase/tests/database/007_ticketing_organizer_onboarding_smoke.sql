-- Run after 20260819180000_ticketing_organizer_onboarding.sql.
-- The transaction rolls back every organizer, attraction and ticketing record.

begin;

do $ticketing_organizer_onboarding_smoke$
declare
  test_user_id uuid;
  test_category_id uuid := gen_random_uuid();
  suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  onboarding_result record;
  stored_state record;
  onboarding_function regprocedure;
begin
  select auth_user.id
    into test_user_id
    from auth.users auth_user
    join public.users profile on profile.id = auth_user.id
   order by auth_user.created_at
   limit 1;

  if test_user_id is null then
    raise exception 'Stage 2C smoke test requires a matching Auth and public user';
  end if;

  insert into public.categories (id, name, slug, icon, description)
  values (
    test_category_id,
    'Stage 2C Category ' || suffix,
    'stage-2c-category-' || suffix,
    'Ticket',
    'Temporary organizer onboarding smoke category.'
  );

  perform set_config('request.jwt.claim.sub', test_user_id::text, true);

  select *
    into onboarding_result
    from public.ticketing_complete_organizer_onboarding(
      'Stage 2C Organization ' || suffix,
      'Stage 2C Legal Name sp. z o.o.',
      '1234567890',
      'stage-2c-billing@example.com',
      'Stage 2C Attraction ' || suffix,
      'stage-2c-attraction-' || suffix,
      'Rodzinna atrakcja utworzona przez atomowy test onboardingu organizatora.',
      test_category_id,
      'Testowa 7',
      '00-007',
      'Warszawa',
      52.229700,
      21.012200,
      jsonb_build_array('https://res.cloudinary.com/enjoyhub/image/upload/stage-2c-attraction.webp'),
      'allocated_quota',
      'Stage 2C Ticket Offer',
      'stage-2c-product-' || suffix,
      'Pierwsza oferta biletowa utworzona w onboardingu.',
      60,
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Bilet normalny',
          'price_amount', 49,
          'capacity_units', 1,
          'max_quantity_per_order', 10
        ),
        jsonb_build_object(
          'name', 'Bilet rodzinny',
          'price_amount', 149,
          'capacity_units', 4,
          'max_quantity_per_order', 2
        )
      ),
      array[1, 2, 3, 4, 5, 6, 7]::smallint[],
      '10:00',
      '18:00',
      60,
      20,
      30,
      current_date + 14
    );

  if onboarding_result.created_organization_id is null
     or onboarding_result.created_venue_id is null
     or onboarding_result.created_property_id is null
     or onboarding_result.created_product_id is null
     or onboarding_result.generated_session_count <= 0 then
    raise exception 'Organizer onboarding did not return a complete setup';
  end if;

  select
    organization.legal_name,
    organization.tax_id,
    organization.billing_email,
    membership.role as owner_role,
    venue.property_id as linked_property_id,
    venue.sales_mode,
    venue.latitude as venue_latitude,
    venue.longitude as venue_longitude,
    property.host_id as property_host_id,
    property.category_id,
    property.is_active as property_is_active,
    property.price_per_night,
    cardinality(property.images) as image_count,
    product.status as product_status
  into stored_state
  from public.organizations organization
  join public.organization_memberships membership
    on membership.organization_id = organization.id
   and membership.user_id = test_user_id
  join public.venues venue
    on venue.organization_id = organization.id
  join public.properties property
    on property.id = venue.property_id
  join public.products product
    on product.venue_id = venue.id
  where organization.id = onboarding_result.created_organization_id
    and venue.id = onboarding_result.created_venue_id
    and property.id = onboarding_result.created_property_id
    and product.id = onboarding_result.created_product_id;

  if stored_state.owner_role <> 'owner'
     or stored_state.legal_name <> 'Stage 2C Legal Name sp. z o.o.'
     or stored_state.tax_id <> '1234567890'
     or stored_state.billing_email <> 'stage-2c-billing@example.com'
     or stored_state.linked_property_id <> onboarding_result.created_property_id
     or stored_state.sales_mode <> 'allocated_quota'
     or stored_state.venue_latitude <> 52.229700
     or stored_state.venue_longitude <> 21.012200
     or stored_state.property_host_id <> test_user_id
     or stored_state.category_id <> test_category_id
     or not stored_state.property_is_active
     or stored_state.price_per_night <> 49
     or stored_state.image_count <> 1
     or stored_state.product_status <> 'active' then
    raise exception 'Organizer onboarding stored an invalid business or marketplace state';
  end if;

  if (select count(*) from public.ticket_types where product_id = onboarding_result.created_product_id) <> 2 then
    raise exception 'Organizer onboarding did not create all ticket types';
  end if;

  if (select count(*) from public.product_schedules where product_id = onboarding_result.created_product_id) <> 7 then
    raise exception 'Organizer onboarding did not create the weekly schedule';
  end if;

  if not exists (
    select 1
    from public.sessions session
    where session.product_id = onboarding_result.created_product_id
      and session.status = 'scheduled'
      and session.starts_at > now()
  ) then
    raise exception 'Organizer onboarding did not create future sessions';
  end if;

  onboarding_function := to_regprocedure(
    'public.ticketing_complete_organizer_onboarding(text,text,text,text,text,text,text,uuid,text,text,text,numeric,numeric,jsonb,public.ticketing_sales_mode,text,text,text,integer,jsonb,smallint[],time without time zone,time without time zone,integer,integer,integer,date)'
  );

  if onboarding_function is null then
    raise exception 'Organizer onboarding function signature is missing';
  end if;

  if has_function_privilege('anon', onboarding_function, 'EXECUTE') then
    raise exception 'anon must not execute organizer onboarding';
  end if;

  if not has_function_privilege('authenticated', onboarding_function, 'EXECUTE') then
    raise exception 'authenticated organizer cannot execute onboarding';
  end if;
end;
$ticketing_organizer_onboarding_smoke$;

rollback;
