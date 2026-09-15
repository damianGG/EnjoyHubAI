-- EnjoyHub marketplace discovery search v2
--
-- Keep filtering, live ticketing availability, effective price, sorting and
-- pagination in one database operation. The RPC is server-only: the public
-- Next.js search route invokes it with the service-role client after validating
-- and bounding request parameters.

create or replace function public.marketplace_search_attractions_v2(
  p_query text default null,
  p_category_slugs text[] default null,
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
  p_max_price numeric default null,
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
    nullif(lower(btrim(p_query)), '') as query_text,
    greatest(1, least(coalesce(p_limit, 20), 50))::integer as page_limit,
    greatest(coalesce(p_offset, 0), 0)::integer as page_offset
),
property_base as (
  select
    property.id,
    property.title,
    property.city,
    property.country,
    property.latitude,
    property.longitude,
    property.price_per_night,
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
    case
      when params.query_text is null then 0
      when lower(property.title) = params.query_text then 100
      when lower(property.title) like params.query_text || '%' then 90
      when lower(property.city) = params.query_text then 80
      when lower(property.title) like '%' || params.query_text || '%' then 70
      when lower(property.city) like params.query_text || '%' then 60
      when lower(property.city) like '%' || params.query_text || '%' then 50
      when lower(property.country) like '%' || params.query_text || '%' then 40
      else 0
    end as relevance_score
  from public.properties property
  cross join search_params params
  left join public.categories category on category.id = property.category_id
  left join public.subcategories subcategory on subcategory.id = property.subcategory_id
  where property.is_active = true
    and (
      params.query_text is null
      or lower(coalesce(property.title, '')) like '%' || params.query_text || '%'
      or lower(coalesce(property.city, '')) like '%' || params.query_text || '%'
      or lower(coalesce(property.country, '')) like '%' || params.query_text || '%'
    )
    and (
      coalesce(cardinality(p_category_slugs), 0) = 0
      or category.slug = any(p_category_slugs)
      or subcategory.slug = any(p_category_slugs)
    )
    and (
      p_west is null or p_south is null or p_east is null or p_north is null
      or (
        property.longitude between p_west and p_east
        and property.latitude between p_south and p_north
      )
    )
),
review_stats as (
  select
    review.property_id,
    round(avg(review.rating)::numeric, 1) as avg_rating,
    count(*)::bigint as review_count
  from public.reviews review
  join property_base property on property.id = review.property_id
  group by review.property_id
),
age_stats as (
  select
    value.property_id,
    max(
      case
        when field.field_name = 'minimum_age' and btrim(value.value) ~ '^\d{1,3}$'
          then btrim(value.value)::integer
        else null
      end
    ) as minimum_age,
    max(
      case
        when field.field_name = 'maximum_age' and btrim(value.value) ~ '^\d{1,3}$'
          then btrim(value.value)::integer
        else null
      end
    ) as maximum_age
  from public.object_field_values value
  join property_base property on property.id = value.property_id
  join public.category_fields field
    on field.id = value.field_id
   and field.field_name in ('minimum_age', 'maximum_age')
  group by value.property_id
),
product_prices as (
  select
    ticket.product_id,
    min(ticket.price_amount) as price_from
  from public.ticket_types ticket
  where ticket.is_active = true
  group by ticket.product_id
),
sellable_products as (
  select
    product.id as product_id,
    coalesce(product.attraction_id, venue.property_id) as property_id,
    venue.timezone,
    product.booking_notice_minutes,
    price.price_from
  from public.products product
  join public.venues venue
    on venue.id = product.venue_id
   and venue.status = 'active'
  join product_prices price on price.product_id = product.id
  where product.status = 'active'
    and product.inventory_mode in ('native_enjoyhub', 'allocated_quota')
    and coalesce(product.attraction_id, venue.property_id) is not null
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
  join property_base property on property.id = product.property_id
  join public.sessions session
    on session.product_id = product.product_id
   and session.status = 'scheduled'
  left join lateral (
    select coalesce(sum(hold.capacity_units) filter (
      where hold.status = 'converted'
         or (hold.status = 'active' and hold.expires_at > now())
    ), 0)::integer as reserved_capacity
    from public.inventory_holds hold
    where hold.session_id = session.id
  ) inventory on true
  where session.starts_at > now()
    and (session.sales_starts_at is null or session.sales_starts_at <= now())
    and (session.sales_ends_at is null or session.sales_ends_at > now())
    and now() <= session.starts_at - make_interval(mins => product.booking_notice_minutes)
    and session.capacity > coalesce(inventory.reserved_capacity, 0)
    and (
      (
        p_start_date is not null
        and p_end_date is not null
        and (session.starts_at at time zone product.timezone)::date between p_start_date and p_end_date
      )
      or (
        p_start_date is null
        and p_end_date is null
        and session.starts_at < now() + interval '91 days'
      )
    )
    and (p_now_deadline is null or session.starts_at <= p_now_deadline)
),
ranked_sessions as (
  select
    candidate.*,
    row_number() over (
      partition by candidate.property_id
      order by candidate.starts_at, candidate.session_id
    ) as session_rank
  from session_candidates candidate
),
session_rollup as (
  select
    property_id,
    min(price_from) as price_from,
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
    session.next_local_date,
    session.next_local_start_time,
    session.next_available_capacity,
    coalesce(session.price_from, property.price_per_night) as effective_price
  from property_base property
  left join review_stats review on review.property_id = property.id
  left join age_stats age on age.property_id = property.id
  left join session_rollup session on session.property_id = property.id
  where (p_age_min is null or coalesce(age.maximum_age, 150) >= p_age_min)
    and (p_age_max is null or coalesce(age.minimum_age, 0) <= p_age_max)
    and (not p_require_availability or session.property_id is not null)
    and (
      p_max_price is null
      or coalesce(session.price_from, property.price_per_night) <= p_max_price
    )
),
ordered as (
  select
    enriched.*,
    row_number() over (
      order by
        case when p_sort = 'price_asc' then enriched.effective_price end asc nulls last,
        case when p_sort = 'price_desc' then enriched.effective_price end desc nulls last,
        case when p_sort = 'rating' then enriched.avg_rating end desc nulls last,
        case when p_sort = 'newest' then enriched.created_at end desc nulls last,
        case when p_sort = 'relevance' then enriched.relevance_score end desc nulls last,
        case when p_sort = 'relevance' then enriched.created_at end desc nulls last,
        enriched.created_at desc,
        enriched.id
    ) as result_position
  from enriched
),
page_rows as (
  select ordered.*
  from ordered
  cross join search_params params
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
        'price_per_night', row.price_per_night,
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
        'next_available_slot', case
          when row.next_local_date is null then null
          else jsonb_build_object(
            'date', row.next_local_date,
            'startTime', row.next_local_start_time,
            'availableCapacity', row.next_available_capacity
          )
        end,
        'price_from', row.price_from
      )
      order by row.result_position
    )
    from page_rows row
  ), '[]'::jsonb),
  'total', (select count(*) from enriched)
);
$$;

revoke all on function public.marketplace_search_attractions_v2(
  text, text[], numeric, numeric, numeric, numeric, integer, integer,
  date, date, timestamptz, boolean, numeric, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.marketplace_search_attractions_v2(
  text, text[], numeric, numeric, numeric, numeric, integer, integer,
  date, date, timestamptz, boolean, numeric, text, integer, integer
) to service_role;

comment on function public.marketplace_search_attractions_v2(
  text, text[], numeric, numeric, numeric, numeric, integer, integer,
  date, date, timestamptz, boolean, numeric, text, integer, integer
) is 'Server-only marketplace discovery RPC. Applies live ticketing availability and effective price before global sorting and pagination.';
