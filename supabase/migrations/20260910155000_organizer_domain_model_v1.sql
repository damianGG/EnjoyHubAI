-- EnjoyHub organizer domain model v1
--
-- Goal:
--   one account -> organization memberships -> venues -> attractions -> products.
--
-- The legacy `properties` table remains the physical marketplace storage for now,
-- but it is treated as an attraction record. This migration is intentionally
-- non-destructive: existing routes and ticketing data continue to work while new
-- relations remove ownership from a single `host_id` user.

begin;

-- 1. An attraction belongs to a venue, not directly to one human account.
alter table public.properties
  add column if not exists venue_id uuid;

alter table public.products
  add column if not exists attraction_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_venue_id_fkey'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_venue_id_fkey
      foreign key (venue_id)
      references public.venues(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_attraction_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_attraction_id_fkey
      foreign key (attraction_id)
      references public.properties(id)
      on delete set null;
  end if;
end
$$;

create index if not exists properties_venue_id_idx
  on public.properties(venue_id)
  where venue_id is not null;

create index if not exists products_attraction_id_idx
  on public.products(attraction_id)
  where attraction_id is not null;

-- Backfill the semantic hierarchy from the existing marketplace bridge.
update public.properties property
   set venue_id = venue.id
  from public.venues venue
 where venue.property_id = property.id
   and property.venue_id is null;

update public.products product
   set attraction_id = venue.property_id
  from public.venues venue
 where product.venue_id = venue.id
   and product.attraction_id is null
   and venue.property_id is not null;

-- A user profile may disappear without deleting the business/attraction content.
-- `host_id` remains a temporary legacy creator/owner hint during the transition.
alter table public.properties
  drop constraint if exists properties_host_id_fkey;

alter table public.properties
  add constraint properties_host_id_fkey
  foreign key (host_id)
  references public.users(id)
  on delete set null;

comment on column public.properties.venue_id is
  'Canonical venue owning this marketplace attraction. The table name properties is legacy storage terminology.';
comment on column public.properties.host_id is
  'DEPRECATED organizer ownership field. Do not use for authorization; use organization_memberships through venue_id.';
comment on column public.products.attraction_id is
  'Marketplace attraction sold by this product. References legacy properties storage until the physical table rename.';
comment on column public.users.is_host is
  'DEPRECATED. Organizer access is derived from organization_memberships.';
comment on column public.users.role is
  'Global platform role only (for example super_admin). Organizer roles are organization_memberships.role.';

-- 2. Organizer authorization is organization-scoped.
drop policy if exists "Hosts can manage their own properties" on public.properties;
drop policy if exists properties_select_organizers on public.properties;
drop policy if exists properties_insert_organizers on public.properties;
drop policy if exists properties_update_organizers on public.properties;
drop policy if exists properties_delete_organizers on public.properties;

create policy properties_select_organizers
on public.properties for select to authenticated
using (
  host_id = auth.uid()
  or (
    venue_id is not null
    and public.ticketing_is_venue_member(
      venue_id,
      array['owner','admin','manager']::public.ticketing_member_role[]
    )
  )
);

create policy properties_insert_organizers
on public.properties for insert to authenticated
with check (
  host_id = auth.uid()
  or (
    venue_id is not null
    and public.ticketing_is_venue_member(
      venue_id,
      array['owner','admin','manager']::public.ticketing_member_role[]
    )
  )
);

create policy properties_update_organizers
on public.properties for update to authenticated
using (
  host_id = auth.uid()
  or (
    venue_id is not null
    and public.ticketing_is_venue_member(
      venue_id,
      array['owner','admin','manager']::public.ticketing_member_role[]
    )
  )
)
with check (
  host_id = auth.uid()
  or (
    venue_id is not null
    and public.ticketing_is_venue_member(
      venue_id,
      array['owner','admin','manager']::public.ticketing_member_role[]
    )
  )
);

create policy properties_delete_organizers
on public.properties for delete to authenticated
using (
  host_id = auth.uid()
  or (
    venue_id is not null
    and public.ticketing_is_venue_member(
      venue_id,
      array['owner','admin','manager']::public.ticketing_member_role[]
    )
  )
);

-- 3. Keep the old venue.property_id bridge synchronized while the application
-- moves to attraction-centric terminology. Linking is authorized by organization
-- membership; host_id is only a fallback for old, not-yet-linked records.
create or replace function public.ticketing_link_venue_property(
  p_venue_id uuid,
  p_property_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_property_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required to link an attraction'
      using errcode = '42501';
  end if;

  if p_venue_id is null or p_property_id is null then
    raise exception 'Venue and attraction are required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.venues venue
    join public.organization_memberships membership
      on membership.organization_id = venue.organization_id
     and membership.user_id = actor_user_id
     and membership.role in ('owner', 'admin', 'manager')
    where venue.id = p_venue_id
      and venue.status not in ('suspended', 'archived')
  ) then
    raise exception 'You cannot manage this venue'
      using errcode = '42501';
  end if;

  select venue.property_id
    into previous_property_id
    from public.venues venue
   where venue.id = p_venue_id;

  if not exists (
    select 1
    from public.properties property
    where property.id = p_property_id
      and property.is_active = true
      and (
        property.host_id = actor_user_id
        or property.venue_id = p_venue_id
        or exists (
          select 1
          from public.venues current_venue
          join public.organization_memberships membership
            on membership.organization_id = current_venue.organization_id
           and membership.user_id = actor_user_id
           and membership.role in ('owner', 'admin', 'manager')
          where current_venue.id = property.venue_id
        )
      )
  ) then
    raise exception 'You cannot link this attraction'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.venues venue
    where venue.property_id = p_property_id
      and venue.id <> p_venue_id
  ) then
    raise exception 'Attraction is already linked to another venue'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.properties property
    where property.id = p_property_id
      and property.venue_id is not null
      and property.venue_id <> p_venue_id
  ) then
    raise exception 'Attraction already belongs to another venue'
      using errcode = '23505';
  end if;

  update public.venues
     set property_id = p_property_id
   where id = p_venue_id;

  update public.properties
     set venue_id = p_venue_id
   where id = p_property_id;

  -- Existing sales created before attraction_id existed are attached to the
  -- attraction selected for this venue. This also handles organizer onboarding,
  -- where the product is created immediately before the attraction record.
  update public.products
     set attraction_id = p_property_id
   where venue_id = p_venue_id
     and (
       attraction_id is null
       or attraction_id = previous_property_id
     );

  return p_venue_id;
end;
$$;

revoke all on function public.ticketing_link_venue_property(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ticketing_link_venue_property(uuid, uuid)
  to authenticated, service_role;

-- New semantic read layer for organizer code. Public discovery still uses the
-- legacy table until all callers have been migrated deliberately.
drop view if exists public.organizer_attractions;
create view public.organizer_attractions
with (security_invoker = true)
as
select
  property.id,
  property.venue_id,
  venue.organization_id,
  property.title as name,
  property.description,
  property.category_id,
  property.subcategory_id,
  property.address,
  property.city,
  property.country,
  property.latitude,
  property.longitude,
  property.images,
  property.is_active,
  property.host_id as legacy_host_id,
  property.created_at,
  property.updated_at
from public.properties property
left join public.venues venue on venue.id = property.venue_id;

revoke all on public.organizer_attractions from public, anon;
grant select on public.organizer_attractions to authenticated, service_role;

comment on view public.organizer_attractions is
  'Organizer-facing semantic view. An attraction belongs to a venue/organization; properties is legacy storage.';

commit;
