create or replace function public.marketplace_location_slug(p_value text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(btrim(p_value)), 'ąćęłńóśźż', 'acelnoszz'),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

revoke all on function public.marketplace_location_slug(text) from public;
grant execute on function public.marketplace_location_slug(text) to anon, authenticated, service_role;

alter table public.properties
  add column if not exists city_slug text
  generated always as (public.marketplace_location_slug(city)) stored;

create index if not exists properties_active_city_slug_idx
  on public.properties (city_slug)
  where is_active = true;

create index if not exists properties_active_city_category_idx
  on public.properties (city_slug, category_id)
  where is_active = true;

create index if not exists properties_active_city_subcategory_idx
  on public.properties (city_slug, subcategory_id)
  where is_active = true;

create or replace function public.marketplace_seo_catalog_v1()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with base as (
  select
    p.city_slug,
    p.city,
    p.country,
    c.slug as category_slug,
    c.name as category_name
  from public.properties p
  left join public.categories c on c.id = p.category_id
  where p.is_active = true
    and coalesce(p.city_slug, '') <> ''
),
city_stats as (
  select
    city_slug,
    (array_agg(
      city
      order by
        (city ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]') desc,
        (city = initcap(lower(city))) desc,
        length(city) desc,
        city
    ))[1] as city_name,
    (array_agg(country order by country))[1] as country,
    count(*)::integer as active_count
  from base
  group by city_slug
),
category_stats as (
  select
    city_slug,
    category_slug,
    (array_agg(category_name order by category_name))[1] as category_name,
    count(*)::integer as active_count
  from base
  where category_slug is not null
  group by city_slug, category_slug
)
select jsonb_build_object(
  'cities', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'slug', city.city_slug,
        'name', city.city_name,
        'country', city.country,
        'active_count', city.active_count,
        'categories', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'slug', category.category_slug,
              'name', category.category_name,
              'active_count', category.active_count
            )
            order by category.active_count desc, category.category_name
          )
          from category_stats category
          where category.city_slug = city.city_slug
        ), '[]'::jsonb)
      )
      order by city.active_count desc, city.city_name
    )
    from city_stats city
  ), '[]'::jsonb)
);
$$;

revoke all on function public.marketplace_seo_catalog_v1() from public, anon, authenticated;
grant execute on function public.marketplace_seo_catalog_v1() to service_role;

create or replace function public.marketplace_seo_landing_v1(
  p_city_slug text,
  p_category_slug text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with params as (
  select
    public.marketplace_location_slug(p_city_slug) as city_slug,
    nullif(lower(btrim(p_category_slug)), '') as category_slug,
    greatest(1, least(coalesce(p_limit, 24), 48))::integer as page_limit,
    greatest(coalesce(p_offset, 0), 0)::integer as page_offset
),
property_base as (
  select
    p.id,
    p.title,
    p.city,
    p.city_slug,
    p.country,
    p.latitude,
    p.longitude,
    p.property_type,
    p.max_guests,
    coalesce(p.images, array[]::text[]) as images,
    p.created_at,
    c.slug as category_slug,
    c.name as category_name,
    sc.slug as subcategory_slug,
    sc.name as subcategory_name
  from public.properties p
  cross join params input
  left join public.categories c on c.id = p.category_id
  left join public.subcategories sc on sc.id = p.subcategory_id
  where p.is_active = true
    and p.city_slug = input.city_slug
    and (
      input.category_slug is null
      or c.slug = input.category_slug
      or sc.slug = input.category_slug
    )
),
review_stats as (
  select
    r.property_id,
    round(avg(r.rating)::numeric, 1) as avg_rating,
    count(*)::integer as review_count
  from public.reviews r
  join property_base p on p.id = r.property_id
  group by r.property_id
),
product_prices as (
  select
    product.id as product_id,
    coalesce(product.attraction_id, venue.property_id) as property_id,
    min(ticket.price_amount) as price_from
  from public.products product
  join public.venues venue
    on venue.id = product.venue_id
   and venue.status = 'active'
  join public.ticket_types ticket
    on ticket.product_id = product.id
   and ticket.is_active = true
  where product.status = 'active'
    and product.inventory_mode in ('native_enjoyhub', 'allocated_quota')
    and coalesce(product.attraction_id, venue.property_id) is not null
  group by product.id, coalesce(product.attraction_id, venue.property_id)
),
sales_stats as (
  select
    prices.property_id,
    min(prices.price_from) as price_from,
    true as has_online_sales
  from product_prices prices
  join property_base p on p.id = prices.property_id
  group by prices.property_id
),
enriched as (
  select
    p.*,
    coalesce(review.avg_rating, 0::numeric) as avg_rating,
    coalesce(review.review_count, 0) as review_count,
    sales.price_from,
    coalesce(sales.has_online_sales, false) as has_online_sales
  from property_base p
  left join review_stats review on review.property_id = p.id
  left join sales_stats sales on sales.property_id = p.id
),
ordered as (
  select
    enriched.*,
    row_number() over (
      order by
        enriched.has_online_sales desc,
        enriched.avg_rating desc,
        enriched.review_count desc,
        enriched.created_at desc,
        enriched.id
    ) as result_position
  from enriched
),
page_rows as (
  select ordered.*
  from ordered
  cross join params input
  where ordered.result_position > input.page_offset
    and ordered.result_position <= input.page_offset + input.page_limit
),
location_meta as (
  select
    city_slug,
    (array_agg(
      city
      order by
        (city ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]') desc,
        (city = initcap(lower(city))) desc,
        length(city) desc,
        city
    ))[1] as city_name,
    (array_agg(country order by country))[1] as country
  from property_base
  group by city_slug
),
category_meta as (
  select slug, name
  from (
    select c.slug, c.name, 1 as priority
    from public.categories c
    union all
    select sc.slug, sc.name, 2 as priority
    from public.subcategories sc
  ) source
  cross join params input
  where input.category_slug is not null
    and source.slug = input.category_slug
  order by priority
  limit 1
)
select jsonb_build_object(
  'location', (
    select jsonb_build_object(
      'slug', location.city_slug,
      'name', location.city_name,
      'country', location.country
    )
    from location_meta location
    limit 1
  ),
  'category', case
    when (select category_slug from params) is null then null
    else (
      select jsonb_build_object('slug', category.slug, 'name', category.name)
      from category_meta category
      limit 1
    )
  end,
  'stats', jsonb_build_object(
    'total', (select count(*) from enriched),
    'online_sales_count', (select count(*) from enriched where has_online_sales),
    'price_from', (select min(price_from) from enriched where price_from is not null),
    'rated_count', (select count(*) from enriched where review_count > 0),
    'average_rating', (select round(avg(avg_rating)::numeric, 1) from enriched where review_count > 0)
  ),
  'items', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'title', row.title,
        'city', row.city,
        'country', row.country,
        'latitude', row.latitude,
        'longitude', row.longitude,
        'property_type', coalesce(row.subcategory_slug, row.category_slug, row.property_type),
        'category_slug', row.category_slug,
        'category_name', row.category_name,
        'subcategory_slug', row.subcategory_slug,
        'subcategory_name', row.subcategory_name,
        'max_guests', row.max_guests,
        'images', to_jsonb(row.images),
        'avg_rating', row.avg_rating,
        'review_count', row.review_count,
        'price_from', row.price_from,
        'has_online_sales', row.has_online_sales
      )
      order by row.result_position
    )
    from page_rows row
  ), '[]'::jsonb)
);
$$;

revoke all on function public.marketplace_seo_landing_v1(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.marketplace_seo_landing_v1(text, text, integer, integer) to service_role;
