alter table public.properties
  add column if not exists seo_indexed boolean not null default false;

alter table public.properties
  add column if not exists seo_indexed_at timestamptz;

comment on column public.properties.seo_indexed is
  'Manual opt-in for search-engine indexing. New attractions stay noindex until explicitly published by platform staff.';

comment on column public.properties.seo_indexed_at is
  'Timestamp of the latest manual SEO publication; null when the attraction is not opted in.';

create index if not exists properties_manual_seo_index_idx
  on public.properties (seo_indexed, updated_at desc)
  where is_active = true
    and seo_excluded = false
    and is_test_data = false;
