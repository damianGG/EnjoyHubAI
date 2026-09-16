-- Marketplace trader traceability: store the organizer's explicit certification
-- that seller information supplied to EnjoyHub is complete, accurate and current.

begin;

alter table public.organizations
  add column if not exists trader_self_certified_at timestamptz;

create or replace function public.organizer_certify_trader_information(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
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
    raise exception 'Only an owner or administrator can certify trader information'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.organizations organization
     where organization.id = p_organization_id
       and char_length(btrim(coalesce(organization.legal_name, ''))) >= 2
       and regexp_replace(coalesce(organization.tax_id, ''), '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
       and char_length(btrim(coalesce(organization.billing_email, ''))) >= 3
       and char_length(btrim(coalesce(organization.legal_address, ''))) >= 8
       and char_length(regexp_replace(coalesce(organization.contact_phone, ''), '[^0-9+]', '', 'g')) >= 7
  ) then
    raise exception 'Complete trader information is required before certification'
      using errcode = '22023';
  end if;

  update public.organizations
     set trader_self_certified_at = now(),
         updated_at = now()
   where id = p_organization_id;
end;
$$;

revoke all on function public.organizer_certify_trader_information(uuid)
from public, anon, authenticated;
grant execute on function public.organizer_certify_trader_information(uuid)
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
         and organization.trader_self_certified_at is not null
         and char_length(btrim(coalesce(organization.legal_name, ''))) >= 2
         and regexp_replace(coalesce(organization.tax_id, ''), '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
         and char_length(btrim(coalesce(organization.billing_email, ''))) >= 3
         and char_length(btrim(coalesce(organization.legal_address, ''))) >= 8
         and char_length(regexp_replace(coalesce(organization.contact_phone, ''), '[^0-9+]', '', 'g')) >= 7
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

commit;