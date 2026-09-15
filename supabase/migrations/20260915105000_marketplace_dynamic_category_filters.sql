-- Dynamic category-specific marketplace filters.
-- Object-level filters use verified Supply attributes linked to an attraction.
-- Product-level filters use category definitions and products.restrictions.

create or replace function public.marketplace_filter_value_matches(
  p_value_type text,
  p_actual jsonb,
  p_condition jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select case
    when p_actual is null or p_condition is null or jsonb_typeof(p_condition) <> 'object' then false
    when p_value_type = 'number' then
      coalesce(p_actual #>> '{}', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      and (
        not (p_condition ? 'eq')
        or (
          coalesce(p_condition ->> 'eq', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          and (p_actual #>> '{}')::numeric = (p_condition ->> 'eq')::numeric
        )
      )
      and (
        not (p_condition ? 'min')
        or (
          coalesce(p_condition ->> 'min', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          and (p_actual #>> '{}')::numeric >= (p_condition ->> 'min')::numeric
        )
      )
      and (
        not (p_condition ? 'max')
        or (
          coalesce(p_condition ->> 'max', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          and (p_actual #>> '{}')::numeric <= (p_condition ->> 'max')::numeric
        )
      )
    when p_value_type = 'boolean' then
      p_condition ? 'eq'
      and lower(coalesce(p_actual #>> '{}', '')) = lower(coalesce(p_condition ->> 'eq', ''))
    else
      p_condition ? 'eq'
      and lower(coalesce(p_actual #>> '{}', '')) = lower(coalesce(p_condition ->> 'eq', ''))
  end;
$$;

revoke all on function public.marketplace_filter_value_matches(text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.marketplace_filter_value_matches(text, jsonb, jsonb)
  to service_role;

create or replace function public.marketplace_search_attractions_v5(
  p_query text default null,
  p_category_slugs text[] default null,
  p_type_slugs text[] default null,
  p_amenities text[] default null,
  p_guests integer default null,
  p_west numeric default null,
  p_south numeric default null,
  p_east numeric default null,
  p_north numeric default null,
  p_age_min integer default null,
  p_age_max integer default null,
  p_start_date date default null,
  p_end_date date default null,
  p_now_deadline timestamptz default null,
  p_require_availability boolean default false,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_supply_filters jsonb default '{}'::jsonb,
  p_product_filters jsonb default '{}'::jsonb,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with search_params as (
  select
    nullif(translate(lower(btrim(p_query)), 'ąćęłńóśźż', 'acelnoszz'), '') as query_text,
    greatest(1, least(coalesce(p_limit, 20), 50))::integer as page_limit,
    greatest(coalesce(p_offset, 0), 0)::integer as page_offset
),
property_source as (
  select
    property.id,
    property.title,
    property.description,
    property.address,
    property.city,
    property.country,
    property.latitude,
    property.longitude,
    property.category_id,
    property.subcategory_id,
    coalesce(property.amenities, array[]::text[]) as amenities,
    coalesce(property.images, array[]::text[]) as images,
    property.created_at,
    category.slug as category_slug,
    category.name as category_name,
    category.icon as category_icon,
    category.image_url as category_image_url,
    subcategory.slug as subcategory_slug,
    subcategory.name as subcategory_name,
    subcategory.icon as subcategory_icon,
    subcategory.image_url as subcategory_image_url,
    coalesce(subcategory.slug, category.slug, 'attraction') as discovery_type,
    translate(lower(concat_ws(' ',
      property.title, property.city, property.country, property.address,
      category.name, category.slug, subcategory.name, subcategory.slug
    )), 'ąćęłńóśźż', 'acelnoszz') as search_text
  from public.properties property
  left join public.categories category on category.id = property.category_id
  left join public.subcategories subcategory on subcategory.id = property.subcategory_id
  where property.is_active = true
),
property_base as (
  select
    property.*,
    case
      when params.query_text is null then 0
      when translate(lower(property.title), 'ąćęłńóśźż', 'acelnoszz') = params.query_text then 120
      when translate(lower(property.title), 'ąćęłńóśźż', 'acelnoszz') like params.query_text || '%' then 110
      when translate(lower(property.city), 'ąćęłńóśźż', 'acelnoszz') = params.query_text then 100
      when translate(lower(property.city), 'ąćęłńóśźż', 'acelnoszz') like params.query_text || '%' then 90
      when translate(lower(property.title), 'ąćęłńóśźż', 'acelnoszz') like '%' || params.query_text || '%' then 80
      when translate(lower(property.city), 'ąćęłńóśźż', 'acelnoszz') like '%' || params.query_text || '%' then 70
      when translate(lower(coalesce(property.category_name, '')), 'ąćęłńóśźż', 'acelnoszz') like '%' || params.query_text || '%' then 60
      when translate(lower(coalesce(property.subcategory_name, '')), 'ąćęłńóśźż', 'acelnoszz') like '%' || params.query_text || '%' then 55
      when translate(lower(property.country), 'ąćęłńóśźż', 'acelnoszz') like '%' || params.query_text || '%' then 40
      else 20
    end as relevance_score
  from property_source property
  cross join search_params params
  where (
      params.query_text is null
      or not exists (
        select 1
        from unnest(regexp_split_to_array(params.query_text, '\s+')) as token(value)
        where token.value <> '' and property.search_text not like '%' || token.value || '%'
      )
    )
    and (
      coalesce(cardinality(p_category_slugs), 0) = 0
      or property.category_slug = any(p_category_slugs)
      or property.subcategory_slug = any(p_category_slugs)
    )
    and (
      coalesce(cardinality(p_type_slugs), 0) = 0
      or property.category_slug = any(p_type_slugs)
      or property.subcategory_slug = any(p_type_slugs)
      or property.discovery_type = any(p_type_slugs)
    )
    and (coalesce(cardinality(p_amenities), 0) = 0 or property.amenities @> p_amenities)
    and (
      p_west is null or p_south is null or p_east is null or p_north is null
      or (property.longitude between p_west and p_east and property.latitude between p_south and p_north)
    )
    and (
      coalesce(p_supply_filters, '{}'::jsonb) = '{}'::jsonb
      or not exists (
        select 1
        from jsonb_each(coalesce(p_supply_filters, '{}'::jsonb)) requested
        where not exists (
          select 1
          from public.supply_leads lead
          join public.supply_attribute_values attribute on attribute.lead_id = lead.id
          join public.supply_attribute_definitions definition on definition.id = attribute.definition_id
          where lead.attraction_id = property.id
            and attribute.verification_status in ('verified', 'owner_confirmed')
            and definition.active = true
            and definition.filterable = true
            and definition.key = requested.key
            and (
              (definition.subcategory_id is not null and definition.subcategory_id = property.subcategory_id)
              or (
                definition.subcategory_id is null
                and definition.category_id is not null
                and definition.category_id = property.category_id
              )
            )
            and public.marketplace_filter_value_matches(definition.value_type, attribute.value, requested.value)
        )
      )
    )
),
review_stats as (
  select review.property_id, round(avg(review.rating)::numeric, 1) as avg_rating, count(*)::bigint as review_count
  from public.reviews review
  join property_base property on property.id = review.property_id
  group by review.property_id
),
age_stats as (
  select
    value.property_id,
    max(case when field.field_name = 'minimum_age' and btrim(value.value) ~ '^\d{1,3}$' then btrim(value.value)::integer end) as minimum_age,
    max(case when field.field_name = 'maximum_age' and btrim(value.value) ~ '^\d{1,3}$' then btrim(value.value)::integer end) as maximum_age
  from public.object_field_values value
  join property_base property on property.id = value.property_id
  join public.category_fields field on field.id = value.field_id and field.field_name in ('minimum_age', 'maximum_age')
  group by value.property_id
),
product_prices as (
  select ticket.product_id, min(ticket.price_amount) as price_from
  from public.ticket_types ticket
  where ticket.is_active = true
  group by ticket.product_id
),
sellable_products as (
  select
    product.id as product_id,
    property.id as property_id,
    venue.timezone,
    product.booking_notice_minutes,
    price.price_from
  from public.products product
  join public.venues venue on venue.id = product.venue_id and venue.status = 'active'
  join property_base property on property.id = coalesce(product.attraction_id, venue.property_id)
  join product_prices price on price.product_id = product.id
  where product.status = 'active'
    and product.inventory_mode in ('native_enjoyhub', 'allocated_quota')
    and (
      coalesce(p_product_filters, '{}'::jsonb) = '{}'::jsonb
      or not exists (
        select 1
        from jsonb_each(coalesce(p_product_filters, '{}'::jsonb)) requested
        where not exists (
          select 1
          from public.product_attribute_definitions definition
          where definition.category_id = property.category_id
            and definition.active = true
            and definition.filterable = true
            and definition.key = requested.key
            and public.marketplace_filter_value_matches(
              definition.value_type,
              coalesce(product.restrictions, '{}'::jsonb) -> definition.key,
              requested.value
            )
        )
      )
    )
),
sellable_properties as (
  select distinct property_id from sellable_products
),
session_candidates as (
  select
    product.property_id,
    session.id as session_id,
    session.starts_at,
    (session.starts_at at time zone product.timezone)::date as local_date,
    to_char(session.starts_at at time zone product.timezone, 'HH24:MI') as local_start_time,
    greatest(session.capacity - coalesce(inventory.reserved_capacity, 0), 0)::integer as available_capacity,
    product.price_from
  from sellable_products product
  join public.sessions session on session.product_id = product.product_id and session.status = 'scheduled'
  left join lateral (
    select coalesce(sum(hold.capacity_units) filter (
      where hold.status = 'converted' or (hold.status = 'active' and hold.expires_at > now())
    ), 0)::integer as reserved_capacity
    from public.inventory_holds hold
    where hold.session_id = session.id
  ) inventory on true
  where session.starts_at > now()
    and (session.sales_starts_at is null or session.sales_starts_at <= now())
    and (session.sales_ends_at is null or session.sales_ends_at > now())
    and now() <= session.starts_at - make_interval(mins => product.booking_notice_minutes)
    and session.capacity > coalesce(inventory.reserved_capacity, 0)
    and (p_guests is null or greatest(session.capacity - coalesce(inventory.reserved_capacity, 0), 0) >= p_guests)
    and (
      (p_start_date is not null and p_end_date is not null and (session.starts_at at time zone product.timezone)::date between p_start_date and p_end_date)
      or (p_start_date is null and p_end_date is null and session.starts_at < now() + interval '91 days')
    )
    and (p_now_deadline is null or session.starts_at <= p_now_deadline)
),
ranked_sessions as (
  select candidate.*, row_number() over (partition by candidate.property_id order by candidate.starts_at, candidate.session_id) as session_rank
  from session_candidates candidate
),
session_rollup as (
  select
    property_id,
    min(price_from) as price_from,
    max(available_capacity) as max_available_capacity,
    max(local_date) filter (where session_rank = 1) as next_local_date,
    max(local_start_time) filter (where session_rank = 1) as next_local_start_time,
    max(available_capacity) filter (where session_rank = 1) as next_available_capacity
  from ranked_sessions
  group by property_id
),
enriched as (
  select
    property.*,
    coalesce(review.avg_rating, 0::numeric) as avg_rating,
    coalesce(review.review_count, 0::bigint) as review_count,
    age.minimum_age,
    age.maximum_age,
    session.price_from,
    coalesce(session.max_available_capacity, 0)::integer as max_guests,
    session.next_local_date,
    session.next_local_start_time,
    session.next_available_capacity,
    (sellable.property_id is not null) as has_online_sales,
    (session.property_id is not null) as has_matching_availability
  from property_base property
  left join review_stats review on review.property_id = property.id
  left join age_stats age on age.property_id = property.id
  left join sellable_properties sellable on sellable.property_id = property.id
  left join session_rollup session on session.property_id = property.id
  where (p_age_min is null or coalesce(age.maximum_age, 150) >= p_age_min)
    and (p_age_max is null or coalesce(age.minimum_age, 0) <= p_age_max)
    and (not p_require_availability or session.property_id is not null)
    and (p_guests is null or sellable.property_id is null or session.property_id is not null)
    and (coalesce(p_product_filters, '{}'::jsonb) = '{}'::jsonb or sellable.property_id is not null)
    and (
      (p_min_price is null and p_max_price is null)
      or (
        session.price_from is not null
        and (p_min_price is null or session.price_from >= p_min_price)
        and (p_max_price is null or session.price_from <= p_max_price)
      )
    )
),
ordered as (
  select
    enriched.*,
    row_number() over (
      order by
        case when p_sort = 'price_asc' then enriched.price_from end asc nulls last,
        case when p_sort = 'price_desc' then enriched.price_from end desc nulls last,
        case when p_sort = 'rating' then enriched.avg_rating end desc nulls last,
        case when p_sort = 'reviews' then enriched.review_count end desc nulls last,
        case when p_sort = 'newest' then enriched.created_at end desc nulls last,
        case when p_sort = 'relevance' then enriched.relevance_score end desc nulls last,
        case when p_sort = 'relevance' then enriched.has_matching_availability end desc nulls last,
        case when p_sort = 'relevance' then enriched.has_online_sales end desc nulls last,
        case when p_sort = 'relevance' then enriched.avg_rating end desc nulls last,
        enriched.created_at desc,
        enriched.id
    ) as result_position
  from enriched
),
page_rows as (
  select ordered.*
  from ordered cross join search_params params
  where ordered.result_position > params.page_offset
    and ordered.result_position <= params.page_offset + params.page_limit
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'title', row.title,
        'city', row.city,
        'country', row.country,
        'region', row.city,
        'latitude', row.latitude,
        'longitude', row.longitude,
        'property_type', row.discovery_type,
        'max_guests', row.max_guests,
        'amenities', to_jsonb(row.amenities),
        'images', to_jsonb(row.images),
        'category_slug', row.category_slug,
        'category_name', row.category_name,
        'category_icon', row.category_icon,
        'category_image_url', row.category_image_url,
        'subcategory_slug', row.subcategory_slug,
        'subcategory_name', row.subcategory_name,
        'subcategory_icon', row.subcategory_icon,
        'subcategory_image_url', row.subcategory_image_url,
        'avg_rating', row.avg_rating,
        'review_count', row.review_count,
        'minimum_age', row.minimum_age,
        'maximum_age', row.maximum_age,
        'cover_image_url', row.images[1],
        'has_online_sales', row.has_online_sales,
        'next_available_slot', case when row.next_local_date is null then null else jsonb_build_object(
          'date', row.next_local_date,
          'startTime', row.next_local_start_time,
          'availableCapacity', row.next_available_capacity
        ) end,
        'price_from', row.price_from
      ) order by row.result_position
    ) from page_rows row
  ), '[]'::jsonb),
  'total', (select count(*) from enriched)
);
$$;

revoke all on function public.marketplace_search_attractions_v5(
  text, text[], text[], text[], integer,
  numeric, numeric, numeric, numeric,
  integer, integer, date, date, timestamptz, boolean,
  numeric, numeric, jsonb, jsonb, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.marketplace_search_attractions_v5(
  text, text[], text[], text[], integer,
  numeric, numeric, numeric, numeric,
  integer, integer, date, date, timestamptz, boolean,
  numeric, numeric, jsonb, jsonb, text, integer, integer
) to service_role;

comment on function public.marketplace_search_attractions_v5(
  text, text[], text[], text[], integer,
  numeric, numeric, numeric, numeric,
  integer, integer, date, date, timestamptz, boolean,
  numeric, numeric, jsonb, jsonb, text, integer, integer
) is 'Server-only marketplace discovery RPC with dynamic category-specific Supply and product filters.';
