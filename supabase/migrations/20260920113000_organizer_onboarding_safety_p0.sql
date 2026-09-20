-- Organizer onboarding safety P0
--
-- Keeps the original onboarding RPC available for rollback and introduces a
-- v2 contract with an explicit launch date, taxonomy leaf, pricing model and
-- participant/order limits. The wrapper remains atomic: if any validation or
-- post-creation update fails, PostgreSQL rolls the whole onboarding back.

begin;

create or replace function public.ticketing_complete_organizer_onboarding_v2(
  p_organization_name text,
  p_legal_name text,
  p_tax_id text,
  p_billing_email text,
  p_attraction_name text,
  p_attraction_slug text,
  p_attraction_description text,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_address text,
  p_postal_code text,
  p_city text,
  p_latitude numeric,
  p_longitude numeric,
  p_images jsonb,
  p_sales_mode public.ticketing_sales_mode,
  p_pricing_model text,
  p_product_name text,
  p_product_slug text,
  p_product_description text,
  p_duration_minutes integer,
  p_min_participants integer,
  p_ticket_types jsonb,
  p_weekdays smallint[],
  p_local_start_time time,
  p_local_end_time time,
  p_slot_interval_minutes integer,
  p_capacity integer,
  p_sales_cutoff_minutes integer,
  p_available_from date,
  p_generate_until date
)
returns table (
  created_organization_id uuid,
  created_venue_id uuid,
  created_property_id uuid,
  created_product_id uuid,
  generated_session_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  onboarding_result record;
  ticket jsonb;
  ticket_minimum integer;
  ticket_maximum integer;
  remaining_session_count integer;
  warsaw_today date := (current_timestamp at time zone 'Europe/Warsaw')::date;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required to complete organizer onboarding'
      using errcode = '42501';
  end if;

  if p_pricing_model is null or p_pricing_model not in ('per_person', 'per_group') then
    raise exception 'Pricing model must be per person or per group'
      using errcode = '22023';
  end if;

  if p_min_participants is null or p_min_participants not between 1 and p_capacity then
    raise exception 'Minimum participants must fit within session capacity'
      using errcode = '22023';
  end if;

  if p_pricing_model = 'per_person' and p_min_participants > 100 then
    raise exception 'Per-person minimum participants cannot exceed the checkout limit'
      using errcode = '22023';
  end if;

  if p_available_from is null
     or p_available_from < warsaw_today
     or p_available_from > warsaw_today + 275
     or p_generate_until < p_available_from
     or p_generate_until > warsaw_today + 366 then
    raise exception 'Availability start or generation end date is outside the supported range'
      using errcode = '22023';
  end if;

  if p_subcategory_id is null and exists (
    select 1
      from public.subcategories subcategory
     where subcategory.parent_category_id = p_category_id
  ) then
    raise exception 'A subcategory is required for the selected category'
      using errcode = '23502';
  end if;

  if p_subcategory_id is not null and not exists (
    select 1
      from public.subcategories subcategory
     where subcategory.id = p_subcategory_id
       and subcategory.parent_category_id = p_category_id
  ) then
    raise exception 'Selected subcategory does not belong to the selected category'
      using errcode = '23503';
  end if;

  if jsonb_typeof(coalesce(p_ticket_types, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_ticket_types, '[]'::jsonb)) = 0 then
    raise exception 'At least one ticket type is required'
      using errcode = '22023';
  end if;

  for ticket in select value from jsonb_array_elements(p_ticket_types)
  loop
    begin
      ticket_minimum := (ticket->>'min_quantity_per_order')::integer;
      ticket_maximum := (ticket->>'max_quantity_per_order')::integer;
    exception when others then
      raise exception 'Ticket order limits must be whole numbers'
        using errcode = '22023';
    end;

    if ticket_minimum not between 1 and 100
       or ticket_maximum not between ticket_minimum and 100 then
      raise exception 'Ticket order limits are invalid'
        using errcode = '22023';
    end if;

    if p_pricing_model = 'per_group' and (
      (ticket->>'capacity_units')::integer <> p_capacity
      or ticket_minimum <> 1
      or ticket_maximum <> 1
    ) then
      raise exception 'A group booking must reserve the complete session'
        using errcode = '22023';
    end if;

    if p_pricing_model = 'per_person' and (
      (ticket->>'capacity_units')::integer <> 1
      or ticket_minimum < p_min_participants
      or ticket_maximum > p_capacity
    ) then
      raise exception 'Per-person ticket limits must match participant limits'
        using errcode = '22023';
    end if;
  end loop;

  select *
    into onboarding_result
    from public.ticketing_complete_organizer_onboarding(
      p_organization_name,
      p_legal_name,
      p_tax_id,
      p_billing_email,
      p_attraction_name,
      p_attraction_slug,
      p_attraction_description,
      p_category_id,
      p_address,
      p_postal_code,
      p_city,
      p_latitude,
      p_longitude,
      p_images,
      p_sales_mode,
      p_product_name,
      p_product_slug,
      p_product_description,
      p_duration_minutes,
      p_ticket_types,
      p_weekdays,
      p_local_start_time,
      p_local_end_time,
      p_slot_interval_minutes,
      p_capacity,
      p_sales_cutoff_minutes,
      p_generate_until
    );

  update public.properties
     set subcategory_id = p_subcategory_id
   where id = onboarding_result.created_property_id;

  update public.products
     set min_participants = p_min_participants,
         max_participants = p_capacity,
         restrictions = coalesce(restrictions, '{}'::jsonb)
           || jsonb_build_object('pricing_model', p_pricing_model)
   where id = onboarding_result.created_product_id;

  with ticket_settings as (
    select
      btrim(value->>'name') as name,
      (value->>'min_quantity_per_order')::integer as minimum,
      (value->>'max_quantity_per_order')::integer as maximum
    from jsonb_array_elements(p_ticket_types)
  )
  update public.ticket_types ticket_type
     set min_quantity_per_order = setting.minimum,
         max_quantity_per_order = setting.maximum
    from ticket_settings setting
   where ticket_type.product_id = onboarding_result.created_product_id
     and ticket_type.name = setting.name;

  update public.product_schedules
     set valid_from = p_available_from
   where product_id = onboarding_result.created_product_id;

  delete from public.sessions session
   using public.venues venue
   where session.product_id = onboarding_result.created_product_id
     and venue.id = onboarding_result.created_venue_id
     and (session.starts_at at time zone venue.timezone)::date < p_available_from;

  select count(*)::integer
    into remaining_session_count
    from public.sessions session
   where session.product_id = onboarding_result.created_product_id
     and session.status = 'scheduled';

  if remaining_session_count = 0 then
    raise exception 'The selected launch date and weekly schedule did not generate a future session'
      using errcode = '22023';
  end if;

  return query select
    onboarding_result.created_organization_id,
    onboarding_result.created_venue_id,
    onboarding_result.created_property_id,
    onboarding_result.created_product_id,
    remaining_session_count;
end;
$$;

comment on function public.ticketing_complete_organizer_onboarding_v2(
  text, text, text, text, text, text, text, uuid, uuid, text, text, text,
  numeric, numeric, jsonb, public.ticketing_sales_mode, text, text, text, text,
  integer, integer, jsonb, smallint[], time, time, integer, integer, integer,
  date, date
) is 'Atomically completes organizer onboarding with an explicit taxonomy leaf, pricing model, participant limits and availability start date.';

revoke all on function public.ticketing_complete_organizer_onboarding_v2(
  text, text, text, text, text, text, text, uuid, uuid, text, text, text,
  numeric, numeric, jsonb, public.ticketing_sales_mode, text, text, text, text,
  integer, integer, jsonb, smallint[], time, time, integer, integer, integer,
  date, date
) from public, anon, authenticated;

grant execute on function public.ticketing_complete_organizer_onboarding_v2(
  text, text, text, text, text, text, text, uuid, uuid, text, text, text,
  numeric, numeric, jsonb, public.ticketing_sales_mode, text, text, text, text,
  integer, integer, jsonb, smallint[], time, time, integer, integer, integer,
  date, date
) to authenticated;

commit;
