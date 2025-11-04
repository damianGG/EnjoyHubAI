create or replace function public.search_places_simple(
  p_bbox text default null,             -- "minLng,minLat,maxLng,maxLat"
  p_categories text[] default null,
  p_q text default null,
  p_sort text default 'popular',        -- 'distance' | 'rating' | 'popular'
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_attr jsonb default null,            -- np. {"parking":"free","outdoor":true}
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id bigint,
  name text,
  category_slug text,
  lat double precision,
  lng double precision,
  rating numeric,
  distance_m double precision
)
language plpgsql
stable
as $$
declare
  v_minlng double precision;
  v_minlat double precision;
  v_maxlng double precision;
  v_maxlat double precision;
begin
  if p_bbox is not null then
    v_minlng := split_part(p_bbox, ',', 1)::double precision;
    v_minlat := split_part(p_bbox, ',', 2)::double precision;
    v_maxlng := split_part(p_bbox, ',', 3)::double precision;
    v_maxlat := split_part(p_bbox, ',', 4)::double precision;
  end if;

  return query
  with base as (
    select
      pl.*,
      case
        when p_center_lat is not null and p_center_lng is not null
        then earth_distance(ll_to_earth(pl.lat, pl.lng), ll_to_earth(p_center_lat, p_center_lng))
        else null
      end as distance_m
    from public.places pl
    where (p_categories is null or pl.category_slug = any(p_categories))
      and (p_bbox is null or (pl.lat between v_minlat and v_maxlat and pl.lng between v_minlng and v_maxlng))
      and (
        p_q is null
        or unaccent(pl.name) ilike unaccent('%' || p_q || '%')
        or unaccent(pl.description) ilike unaccent('%' || p_q || '%')
      )
      and (
        p_attr is null
        or pl.attributes @> p_attr -- proste dopasowanie klucz→wartość
      )
  )
  select
    base.id, base.name, base.category_slug, base.lat, base.lng, base.rating, base.distance_m
  from base
  order by
    case when p_sort = 'distance' then base.distance_m end asc nulls last,
    case when p_sort = 'rating' then base.rating end desc nulls last,
    base.id desc
  limit p_limit
  offset p_offset;
end $$;
