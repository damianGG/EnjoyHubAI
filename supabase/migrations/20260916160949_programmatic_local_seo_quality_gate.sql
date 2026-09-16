alter table public.properties
  add column if not exists seo_excluded boolean not null default false;

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
    c.name as category_name,
    (
      not p.seo_excluded
      and length(btrim(coalesce(p.title, ''))) >= 5
      and length(btrim(coalesce(p.description, ''))) >= 50
      and length(btrim(coalesce(p.address, ''))) >= 8
      and p.category_id is not null
      and cardinality(coalesce(p.images, array[]::text[])) >= 1
      and p.latitude is not null
      and p.longitude is not null
      and p.latitude between -90 and 90
      and p.longitude between -180 and 180
    ) as seo_eligible
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
    count(*)::integer as active_count,
    count(*) filter (where seo_eligible)::integer as seo_eligible_count
  from base
  group by city_slug
),
category_stats as (
  select
    city_slug,
    category_slug,
    (array_agg(category_name order by category_name))[1] as category_name,
    count(*)::integer as active_count,
    count(*) filter (where seo_eligible)::integer as seo_eligible_count
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
        'seo_eligible_count', city.seo_eligible_count,
        'categories', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'slug', category.category_slug,
              'name', category.category_name,
              'active_count', category.active_count,
              'seo_eligible_count', category.seo_eligible_count
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
