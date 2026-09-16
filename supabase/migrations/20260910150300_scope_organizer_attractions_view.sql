-- Restrict the organizer-facing attraction view to attractions that the current
-- user can actually manage. The underlying properties table intentionally has a
-- public read policy for active marketplace records, so the view must add its
-- own organizer scope instead of relying on that public policy.

begin;

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
left join public.venues venue on venue.id = property.venue_id
where
  property.host_id = auth.uid()
  or (
    property.venue_id is not null
    and public.ticketing_is_venue_member(
      property.venue_id,
      array['owner','admin','manager']::public.ticketing_member_role[]
    )
  );

revoke all on public.organizer_attractions from public, anon;
grant select on public.organizer_attractions to authenticated, service_role;

comment on view public.organizer_attractions is
  'Organizer-facing attraction view scoped to legacy creator or owner/admin/manager organization membership.';

commit;
