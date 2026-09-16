alter table public.properties
  add column if not exists is_test_data boolean not null default false;

comment on column public.properties.is_test_data is
  'True only for non-production fixture/demo records. Test records must never be public or indexable.';

update public.properties
set is_test_data = true,
    is_active = false,
    seo_excluded = true,
    updated_at = now()
where id in (
  'e12145a7-48e3-4042-84df-f482a265736f',
  '9ed64226-76ad-4aea-b213-7b87380806fd',
  'f19c1894-3a27-4d1d-b1da-b7dd54fb20e3',
  '140dcbf8-cf06-49b1-859b-bae76b2766e5',
  'ade8ebd2-b32b-46ea-97bb-949324fdc546',
  'ab65c50f-94cc-49c0-a9c7-85b7972540eb',
  '8783bb17-96bc-4a65-9721-777c27c1a2b4',
  '9c2fd8ed-c9e8-4f8d-92ee-c3d774cf8ffb',
  '3c04e202-5096-441a-a58c-d2f3f192ba88',
  '472d656f-8bb7-4e44-915d-d94f061e2880',
  '518e1f91-d028-47db-9f59-3fc9aaec7539',
  '5b261abf-a30f-4cf7-83bf-fc83982752ba',
  'd9eed57d-8094-4420-8b09-f0cf8b21b1a3',
  'e911582f-dd0f-43ca-a186-a7669b4b93cc',
  '4b542784-91eb-4a03-ac56-3c06e8b4f05f',
  '1ed16f98-8647-498c-b824-a571d9072d8d',
  'abca5340-e82f-4fd5-ace9-897e7a742878',
  'ef9c9290-eaed-4c35-9db3-49ffc442907a',
  'eb4170ea-b850-41e4-b48c-fde38edb0113'
);

update public.products
set status = 'draft',
    updated_at = now()
where venue_id = '931a44e6-6172-4974-afd5-a473ef3a619c'
  and status = 'active';

update public.venues
set status = 'draft',
    updated_at = now()
where id = '931a44e6-6172-4974-afd5-a473ef3a619c'
  and status = 'active';

alter table public.properties
  drop constraint if exists properties_test_data_visibility_check;

alter table public.properties
  add constraint properties_test_data_visibility_check
  check (
    not is_test_data
    or (is_active = false and coalesce(seo_excluded, false) = true)
  );

create index if not exists properties_public_catalog_idx
  on public.properties (is_active, is_test_data, seo_excluded)
  where is_active = true and is_test_data = false and coalesce(seo_excluded, false) = false;
