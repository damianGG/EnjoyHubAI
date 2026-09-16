-- Organizer verification and payment readiness.
-- Existing organizations are grandfathered to preserve current sales behavior.
-- New organizations start unverified and cannot open online payments until approved.

begin;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'organizer_verification_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.organizer_verification_status as enum (
      'not_started',
      'pending',
      'verified',
      'rejected'
    );
  end if;
end
$$;

alter table public.organizations
  add column if not exists verification_status public.organizer_verification_status not null default 'not_started',
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists payments_enabled boolean not null default false;

-- Do not unexpectedly disable organizations that already existed before this migration.
update public.organizations
   set verification_status = 'verified',
       payments_enabled = true,
       verified_at = coalesce(verified_at, now())
 where verification_status = 'not_started'
   and verification_submitted_at is null
   and verified_at is null;

create or replace function public.organizer_submit_verification(
  p_organization_id uuid,
  p_legal_name text,
  p_tax_id text,
  p_billing_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_tax_id text := regexp_replace(coalesce(p_tax_id, ''), '[^0-9]', '', 'g');
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.organization_memberships membership
     where membership.organization_id = p_organization_id
       and membership.user_id = actor_user_id
       and membership.role in ('owner', 'admin')
  ) then
    raise exception 'Only an owner or administrator can submit verification'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_legal_name, ''))) < 2 then
    raise exception 'Legal name is required' using errcode = '22023';
  end if;

  if normalized_tax_id !~ '^[0-9]{10}$' then
    raise exception 'Polish tax ID must contain 10 digits' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_billing_email, ''))) < 3
     or position('@' in p_billing_email) <= 1 then
    raise exception 'Valid billing email is required' using errcode = '22023';
  end if;

  update public.organizations
     set legal_name = btrim(p_legal_name),
         tax_id = normalized_tax_id,
         billing_email = lower(btrim(p_billing_email)),
         verification_status = 'pending',
         verification_submitted_at = now(),
         verified_at = null,
         payments_enabled = false,
         updated_at = now()
   where id = p_organization_id;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.organizer_submit_verification(uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.organizer_submit_verification(uuid, text, text, text)
to authenticated, service_role;

create or replace function public.ticketing_order_payment_allowed(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select organization.payments_enabled
         and organization.verification_status = 'verified'
        from public.orders ticket_order
        join public.organizations organization
          on organization.id = ticket_order.organization_id
       where ticket_order.id = p_order_id
    ),
    false
  );
$$;

revoke all on function public.ticketing_order_payment_allowed(uuid)
from public, anon, authenticated;
grant execute on function public.ticketing_order_payment_allowed(uuid)
to service_role;

comment on column public.organizations.verification_status is
  'Organizer identity/business verification state. Publication may precede verification; online payments must not.';
comment on column public.organizations.payments_enabled is
  'Explicit platform approval for online payments. Requires verification_status=verified.';

commit;