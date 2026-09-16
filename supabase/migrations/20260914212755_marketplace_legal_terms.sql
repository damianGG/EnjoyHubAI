-- Marketplace legal/compliance foundation for checkout.
-- Adds seller contact data, per-offer cancellation rules and immutable legal snapshots on orders.

begin;

alter table public.organizations
  add column if not exists legal_address text,
  add column if not exists contact_phone text,
  add column if not exists registry_name text,
  add column if not exists registry_number text;

alter table public.products
  add column if not exists cancellation_policy_code text not null default 'flexible_24h',
  add column if not exists cancellation_deadline_hours integer not null default 24,
  add column if not exists cancellation_policy_text text;

alter table public.products
  drop constraint if exists products_cancellation_policy_code_check,
  add constraint products_cancellation_policy_code_check
    check (cancellation_policy_code in ('flexible_24h', 'non_refundable', 'custom')),
  drop constraint if exists products_cancellation_deadline_hours_check,
  add constraint products_cancellation_deadline_hours_check
    check (cancellation_deadline_hours between 0 and 720),
  drop constraint if exists products_custom_cancellation_policy_check,
  add constraint products_custom_cancellation_policy_check
    check (
      cancellation_policy_code <> 'custom'
      or char_length(btrim(coalesce(cancellation_policy_text, ''))) between 20 and 2000
    );

alter table public.orders
  add column if not exists marketplace_terms_version text,
  add column if not exists cancellation_policy_version text,
  add column if not exists seller_snapshot jsonb,
  add column if not exists cancellation_policy_snapshot jsonb,
  add column if not exists platform_snapshot jsonb;

alter table public.orders
  drop constraint if exists orders_seller_snapshot_object_check,
  add constraint orders_seller_snapshot_object_check
    check (seller_snapshot is null or jsonb_typeof(seller_snapshot) = 'object'),
  drop constraint if exists orders_cancellation_policy_snapshot_object_check,
  add constraint orders_cancellation_policy_snapshot_object_check
    check (cancellation_policy_snapshot is null or jsonb_typeof(cancellation_policy_snapshot) = 'object'),
  drop constraint if exists orders_platform_snapshot_object_check,
  add constraint orders_platform_snapshot_object_check
    check (platform_snapshot is null or jsonb_typeof(platform_snapshot) = 'object');

comment on column public.orders.marketplace_terms_version is
  'Immutable version identifier of EnjoyHub marketplace terms accepted for this order.';
comment on column public.orders.cancellation_policy_version is
  'Immutable version identifier of the cancellation policy wording accepted for this order.';
comment on column public.orders.seller_snapshot is
  'Seller/service-provider identity shown to the customer at checkout, frozen at order creation.';
comment on column public.orders.cancellation_policy_snapshot is
  'Cancellation/refund rules shown to the customer at checkout, frozen at order creation.';
comment on column public.orders.platform_snapshot is
  'Marketplace operator identity and responsibility split shown to the customer at checkout.';

-- Replace the old four-field verification function. A verified seller must expose
-- the contact data required for a distance contract before online payment can open.
drop function if exists public.organizer_submit_verification(uuid, text, text, text);

create or replace function public.organizer_submit_verification(
  p_organization_id uuid,
  p_legal_name text,
  p_tax_id text,
  p_billing_email text,
  p_legal_address text,
  p_contact_phone text,
  p_registry_name text default null,
  p_registry_number text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_tax_id text := regexp_replace(coalesce(p_tax_id, ''), '[^0-9]', '', 'g');
  normalized_registry_name text := nullif(btrim(coalesce(p_registry_name, '')), '');
  normalized_registry_number text := nullif(btrim(coalesce(p_registry_number, '')), '');
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

  if char_length(btrim(coalesce(p_legal_address, ''))) < 8 then
    raise exception 'Legal address is required' using errcode = '22023';
  end if;

  if char_length(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9+]', '', 'g')) < 7 then
    raise exception 'Contact phone is required' using errcode = '22023';
  end if;

  update public.organizations
     set legal_name = btrim(p_legal_name),
         tax_id = normalized_tax_id,
         billing_email = lower(btrim(p_billing_email)),
         legal_address = btrim(p_legal_address),
         contact_phone = btrim(p_contact_phone),
         registry_name = normalized_registry_name,
         registry_number = normalized_registry_number,
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

revoke all on function public.organizer_submit_verification(uuid, text, text, text, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.organizer_submit_verification(uuid, text, text, text, text, text, text, text)
to authenticated, service_role;

-- Payment readiness now also guarantees that the customer can identify and
-- contact the seller before paying.
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

-- The checkout API calls this directly after the idempotent order/hold RPC.
-- It makes the exact legal state accepted by the customer immutable and retry-safe.
create or replace function public.ticketing_attach_legal_acceptance(
  p_order_id uuid,
  p_hold_token uuid,
  p_marketplace_terms_version text,
  p_cancellation_policy_version text,
  p_seller_snapshot jsonb,
  p_cancellation_policy_snapshot jsonb,
  p_platform_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_state public.orders%rowtype;
  hold_state public.inventory_holds%rowtype;
begin
  if p_order_id is null or p_hold_token is null then
    raise exception 'Order and hold token are required' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_marketplace_terms_version, ''))) < 4
     or char_length(btrim(coalesce(p_cancellation_policy_version, ''))) < 4
     or p_seller_snapshot is null or jsonb_typeof(p_seller_snapshot) <> 'object'
     or p_cancellation_policy_snapshot is null or jsonb_typeof(p_cancellation_policy_snapshot) <> 'object'
     or p_platform_snapshot is null or jsonb_typeof(p_platform_snapshot) <> 'object' then
    raise exception 'Complete legal acceptance snapshot is required' using errcode = '22023';
  end if;

  select * into order_state
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select * into hold_state
    from public.inventory_holds
   where order_id = p_order_id
     and hold_token = p_hold_token
   for update;

  if not found or hold_state.status <> 'active' or hold_state.expires_at <= clock_timestamp() then
    raise exception 'Active checkout hold is required' using errcode = 'P0001';
  end if;

  if order_state.status <> 'awaiting_payment' or order_state.terms_accepted_at is null then
    raise exception 'Order has no accepted checkout terms' using errcode = 'P0001';
  end if;

  if order_state.marketplace_terms_version is not null then
    if order_state.marketplace_terms_version <> p_marketplace_terms_version
       or order_state.cancellation_policy_version <> p_cancellation_policy_version
       or order_state.seller_snapshot is distinct from p_seller_snapshot
       or order_state.cancellation_policy_snapshot is distinct from p_cancellation_policy_snapshot
       or order_state.platform_snapshot is distinct from p_platform_snapshot then
      raise exception 'Legal acceptance already exists with different content' using errcode = 'P0001';
    end if;
    return;
  end if;

  update public.orders
     set marketplace_terms_version = p_marketplace_terms_version,
         cancellation_policy_version = p_cancellation_policy_version,
         seller_snapshot = p_seller_snapshot,
         cancellation_policy_snapshot = p_cancellation_policy_snapshot,
         platform_snapshot = p_platform_snapshot,
         metadata = metadata || jsonb_build_object(
           'legal_acceptance', jsonb_build_object(
             'terms_version', p_marketplace_terms_version,
             'cancellation_version', p_cancellation_policy_version,
             'accepted_at', order_state.terms_accepted_at
           )
         )
   where id = p_order_id;
end;
$$;

revoke all on function public.ticketing_attach_legal_acceptance(uuid, uuid, text, text, jsonb, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.ticketing_attach_legal_acceptance(uuid, uuid, text, text, jsonb, jsonb, jsonb)
to service_role;

-- Owners/admins/managers can choose the cancellation rule per ticketing product.
create or replace function public.ticketing_update_cancellation_policy(
  p_product_id uuid,
  p_policy_code text,
  p_deadline_hours integer default 24,
  p_custom_text text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  target_organization_id uuid;
  normalized_custom_text text := nullif(btrim(coalesce(p_custom_text, '')), '');
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_policy_code not in ('flexible_24h', 'non_refundable', 'custom') then
    raise exception 'Unsupported cancellation policy' using errcode = '22023';
  end if;

  if p_deadline_hours is null or p_deadline_hours < 0 or p_deadline_hours > 720 then
    raise exception 'Cancellation deadline is invalid' using errcode = '22023';
  end if;

  if p_policy_code = 'custom' and char_length(coalesce(normalized_custom_text, '')) not between 20 and 2000 then
    raise exception 'Custom cancellation policy must contain 20-2000 characters' using errcode = '22023';
  end if;

  select venue.organization_id
    into target_organization_id
    from public.products product
    join public.venues venue on venue.id = product.venue_id
   where product.id = p_product_id;

  if target_organization_id is null then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    target_organization_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot update this cancellation policy' using errcode = '42501';
  end if;

  update public.products
     set cancellation_policy_code = p_policy_code,
         cancellation_deadline_hours = case when p_policy_code = 'non_refundable' then 0 else p_deadline_hours end,
         cancellation_policy_text = case when p_policy_code = 'custom' then normalized_custom_text else null end,
         updated_at = now()
   where id = p_product_id;
end;
$$;

revoke all on function public.ticketing_update_cancellation_policy(uuid, text, integer, text)
from public, anon, authenticated;
grant execute on function public.ticketing_update_cancellation_policy(uuid, text, integer, text)
to authenticated, service_role;

commit;