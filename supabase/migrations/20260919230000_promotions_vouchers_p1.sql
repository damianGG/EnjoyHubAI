-- EnjoyHub Organizer OS P1
-- Unified promotions / vouchers with atomic usage limits and order snapshots.

begin;

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  kind text not null check (kind in ('promotion','voucher')),
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  currency text,
  minimum_subtotal numeric(12,2) not null default 0 check (minimum_subtotal >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  max_uses_per_customer integer check (max_uses_per_customer is null or max_uses_per_customer > 0),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (
    (discount_type = 'percentage' and discount_value <= 100 and currency is null)
    or
    (discount_type = 'fixed' and currency ~ '^[A-Z]{3}$')
  )
);

create unique index promotions_organization_code_uidx
  on public.promotions(organization_id, code);
create index promotions_active_window_idx
  on public.promotions(organization_id, is_active, valid_from, valid_until);
create index promotions_product_idx
  on public.promotions(product_id)
  where product_id is not null;

create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_key text,
  code_snapshot text not null,
  kind_snapshot text not null check (kind_snapshot in ('promotion','voucher')),
  discount_type_snapshot text not null check (discount_type_snapshot in ('percentage','fixed')),
  discount_value_snapshot numeric(12,2) not null,
  subtotal_amount numeric(12,2) not null check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (order_id),
  unique (promotion_id, order_id)
);

create index promotion_redemptions_promotion_idx
  on public.promotion_redemptions(promotion_id, created_at desc);
create index promotion_redemptions_customer_idx
  on public.promotion_redemptions(promotion_id, customer_key)
  where customer_key is not null;

create trigger promotions_updated_at
before update on public.promotions
for each row execute function public.ticketing_set_updated_at();

alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;

create policy promotions_select_org_members
on public.promotions for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  )
);

create policy promotion_redemptions_select_org_members
on public.promotion_redemptions for select to authenticated
using (
  exists (
    select 1
    from public.promotions promotion
    where promotion.id = promotion_redemptions.promotion_id
      and public.ticketing_is_org_member(
        promotion.organization_id,
        array['owner','admin','manager','viewer']::public.ticketing_member_role[]
      )
  )
);

revoke all on table public.promotions, public.promotion_redemptions
from public, anon, authenticated;
grant select on table public.promotions, public.promotion_redemptions to authenticated;
grant all on table public.promotions, public.promotion_redemptions to service_role;

create or replace function public.ticketing_normalize_promotion_code(p_code text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select upper(regexp_replace(btrim(coalesce(p_code,'')), '\s+', '', 'g'))
$$;

revoke all on function public.ticketing_normalize_promotion_code(text) from public, anon;
grant execute on function public.ticketing_normalize_promotion_code(text)
to authenticated, service_role;

create or replace function public.ticketing_promotion_customer_key(
  p_customer_user_id uuid,
  p_customer_email text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_customer_user_id is not null then 'user:' || p_customer_user_id::text
    when nullif(lower(btrim(coalesce(p_customer_email,''))), '') is not null
      then 'email:' || lower(btrim(p_customer_email))
    else null
  end
$$;

revoke all on function public.ticketing_promotion_customer_key(uuid,text)
from public, anon;
grant execute on function public.ticketing_promotion_customer_key(uuid,text)
to authenticated, service_role;

create or replace function public.ticketing_create_promotion(
  p_organization_id uuid,
  p_name text,
  p_code text,
  p_kind text,
  p_discount_type text,
  p_discount_value numeric,
  p_currency text default null,
  p_minimum_subtotal numeric default 0,
  p_max_uses integer default null,
  p_max_uses_per_customer integer default null,
  p_valid_from timestamptz default null,
  p_valid_until timestamptz default null,
  p_product_id uuid default null,
  p_venue_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_code text := public.ticketing_normalize_promotion_code(p_code);
  resolved_venue_id uuid;
  new_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not public.ticketing_is_org_member(
    p_organization_id,
    array['owner','admin','manager']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot manage promotions for this organization'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name,''))) not between 2 and 160
     or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
     or p_kind not in ('promotion','voucher')
     or p_discount_type not in ('percentage','fixed')
     or p_discount_value is null
     or p_discount_value <= 0
     or (p_discount_type = 'percentage' and p_discount_value > 100)
     or coalesce(p_minimum_subtotal, 0) < 0
     or (p_max_uses is not null and p_max_uses <= 0)
     or (p_max_uses_per_customer is not null and p_max_uses_per_customer <= 0)
     or (p_valid_from is not null and p_valid_until is not null and p_valid_until <= p_valid_from) then
    raise exception 'Invalid promotion configuration' using errcode = '22023';
  end if;

  if p_discount_type = 'fixed'
     and upper(coalesce(p_currency,'')) !~ '^[A-Z]{3}$' then
    raise exception 'Fixed discount requires a currency' using errcode = '22023';
  end if;

  if p_venue_id is not null then
    select venue.id into resolved_venue_id
    from public.venues venue
    where venue.id = p_venue_id
      and venue.organization_id = p_organization_id;

    if resolved_venue_id is null then
      raise exception 'Promotion venue does not belong to organization'
        using errcode = '22023';
    end if;
  end if;

  if p_product_id is not null then
    select venue.id into resolved_venue_id
    from public.products product
    join public.venues venue on venue.id = product.venue_id
    where product.id = p_product_id
      and venue.organization_id = p_organization_id;

    if resolved_venue_id is null then
      raise exception 'Promotion product does not belong to organization'
        using errcode = '22023';
    end if;

    if p_venue_id is not null and p_venue_id <> resolved_venue_id then
      raise exception 'Promotion product and venue scopes do not match'
        using errcode = '22023';
    end if;
  end if;

  insert into public.promotions (
    organization_id,
    venue_id,
    product_id,
    name,
    code,
    kind,
    discount_type,
    discount_value,
    currency,
    minimum_subtotal,
    max_uses,
    max_uses_per_customer,
    valid_from,
    valid_until,
    created_by
  ) values (
    p_organization_id,
    coalesce(p_venue_id, case when p_product_id is not null then resolved_venue_id else null end),
    p_product_id,
    btrim(p_name),
    normalized_code,
    p_kind,
    p_discount_type,
    p_discount_value,
    case when p_discount_type = 'fixed' then upper(p_currency) else null end,
    coalesce(p_minimum_subtotal, 0),
    p_max_uses,
    p_max_uses_per_customer,
    p_valid_from,
    p_valid_until,
    actor_user_id
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    raise exception 'Promotion code already exists in this organization'
      using errcode = '23505';
end;
$$;

revoke all on function public.ticketing_create_promotion(
  uuid,text,text,text,text,numeric,text,numeric,integer,integer,timestamptz,timestamptz,uuid,uuid
) from public, anon;
grant execute on function public.ticketing_create_promotion(
  uuid,text,text,text,text,numeric,text,numeric,integer,integer,timestamptz,timestamptz,uuid,uuid
) to authenticated, service_role;

create or replace function public.ticketing_set_promotion_active(
  p_promotion_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  promotion_org_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select organization_id into promotion_org_id
  from public.promotions
  where id = p_promotion_id
  for update;

  if promotion_org_id is null then
    raise exception 'Promotion does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    promotion_org_id,
    array['owner','admin','manager']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot manage this promotion' using errcode = '42501';
  end if;

  update public.promotions
  set is_active = p_active
  where id = p_promotion_id;

  return p_active;
end;
$$;

revoke all on function public.ticketing_set_promotion_active(uuid,boolean)
from public, anon;
grant execute on function public.ticketing_set_promotion_active(uuid,boolean)
to authenticated, service_role;

create or replace function public.ticketing_quote_promotion(
  p_session_id uuid,
  p_code text,
  p_items jsonb,
  p_customer_email text default null,
  p_customer_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  normalized_code text := public.ticketing_normalize_promotion_code(p_code);
  session_context record;
  promotion_row public.promotions%rowtype;
  subtotal numeric(12,2);
  order_currency text;
  currency_count integer;
  customer_key text;
  total_uses integer;
  customer_uses integer;
  discount_amount numeric(12,2);
begin
  if p_session_id is null
     or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
     or p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 20 then
    raise exception 'Promotion code is invalid or unavailable' using errcode = 'P0001';
  end if;

  select
    session.id as session_id,
    product.id as product_id,
    venue.id as venue_id,
    venue.organization_id
  into session_context
  from public.sessions session
  join public.products product on product.id = session.product_id
  join public.venues venue on venue.id = product.venue_id
  where session.id = p_session_id;

  if not found then
    raise exception 'Promotion code is invalid or unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    left join public.ticket_types ticket
      on ticket.id = case
        when coalesce(item ->> 'ticket_type_id','')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (item ->> 'ticket_type_id')::uuid
        else null
      end
    where jsonb_typeof(item) <> 'object'
      or ticket.id is null
      or ticket.product_id <> session_context.product_id
      or not ticket.is_active
      or coalesce(item ->> 'quantity','') !~ '^[1-9][0-9]*$'
      or (item ->> 'quantity')::integer < ticket.min_quantity_per_order
      or (
        ticket.max_quantity_per_order is not null
        and (item ->> 'quantity')::integer > ticket.max_quantity_per_order
      )
  ) then
    raise exception 'Promotion quote contains invalid tickets' using errcode = '22023';
  end if;

  with requested as (
    select
      (item ->> 'ticket_type_id')::uuid as ticket_type_id,
      (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
  )
  select
    sum(requested.quantity * ticket.price_amount)::numeric(12,2),
    min(ticket.currency),
    count(distinct ticket.currency)::integer
  into subtotal, order_currency, currency_count
  from requested
  join public.ticket_types ticket on ticket.id = requested.ticket_type_id;

  if currency_count <> 1 or subtotal is null then
    raise exception 'Promotion quote has invalid currency' using errcode = '22023';
  end if;

  select promotion.*
  into promotion_row
  from public.promotions promotion
  where promotion.organization_id = session_context.organization_id
    and promotion.code = normalized_code
    and promotion.is_active
    and (promotion.venue_id is null or promotion.venue_id = session_context.venue_id)
    and (promotion.product_id is null or promotion.product_id = session_context.product_id)
    and (promotion.valid_from is null or promotion.valid_from <= statement_timestamp())
    and (promotion.valid_until is null or promotion.valid_until > statement_timestamp());

  if not found then
    raise exception 'Promotion code is invalid or unavailable' using errcode = 'P0001';
  end if;

  if subtotal < promotion_row.minimum_subtotal then
    raise exception 'Promotion minimum subtotal not reached' using errcode = 'P0001';
  end if;

  if promotion_row.discount_type = 'fixed'
     and promotion_row.currency <> order_currency then
    raise exception 'Promotion currency does not match order' using errcode = 'P0001';
  end if;

  customer_key := public.ticketing_promotion_customer_key(
    p_customer_user_id,
    p_customer_email
  );

  select count(*)::integer
  into total_uses
  from public.promotion_redemptions redemption
  join public.orders customer_order on customer_order.id = redemption.order_id
  where redemption.promotion_id = promotion_row.id
    and (
      customer_order.status in ('confirmed','partially_refunded','refunded')
      or (
        customer_order.status = 'awaiting_payment'
        and exists (
          select 1
          from public.inventory_holds hold
          where hold.order_id = customer_order.id
            and hold.status = 'active'
            and hold.expires_at > statement_timestamp()
        )
      )
    );

  if promotion_row.max_uses is not null and total_uses >= promotion_row.max_uses then
    raise exception 'Promotion usage limit reached' using errcode = 'P0001';
  end if;

  if promotion_row.max_uses_per_customer is not null then
    if customer_key is null then
      raise exception 'Promotion customer limit requires identity' using errcode = 'P0001';
    end if;

    select count(*)::integer
    into customer_uses
    from public.promotion_redemptions redemption
    join public.orders customer_order on customer_order.id = redemption.order_id
    where redemption.promotion_id = promotion_row.id
      and redemption.customer_key = customer_key
      and (
        customer_order.status in ('confirmed','partially_refunded','refunded')
        or (
          customer_order.status = 'awaiting_payment'
          and exists (
            select 1
            from public.inventory_holds hold
            where hold.order_id = customer_order.id
              and hold.status = 'active'
              and hold.expires_at > statement_timestamp()
          )
        )
      );

    if customer_uses >= promotion_row.max_uses_per_customer then
      raise exception 'Promotion customer usage limit reached' using errcode = 'P0001';
    end if;
  end if;

  discount_amount := least(
    subtotal,
    case
      when promotion_row.discount_type = 'percentage'
        then round(subtotal * promotion_row.discount_value / 100, 2)
      else promotion_row.discount_value
    end
  );

  return jsonb_build_object(
    'promotionId', promotion_row.id,
    'code', promotion_row.code,
    'name', promotion_row.name,
    'kind', promotion_row.kind,
    'discountType', promotion_row.discount_type,
    'subtotalAmount', subtotal,
    'discountAmount', discount_amount,
    'totalAmount', subtotal - discount_amount,
    'currency', order_currency
  );
end;
$$;

revoke all on function public.ticketing_quote_promotion(uuid,text,jsonb,text,uuid)
from public, anon, authenticated;
grant execute on function public.ticketing_quote_promotion(uuid,text,jsonb,text,uuid)
to service_role;

create or replace function public.ticketing_apply_promotion_to_order(
  p_order_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_code text := public.ticketing_normalize_promotion_code(p_code);
  order_row public.orders%rowtype;
  promotion_row public.promotions%rowtype;
  existing_redemption public.promotion_redemptions%rowtype;
  product_id uuid;
  product_count integer;
  customer_key text;
  total_uses integer;
  customer_uses integer;
  calculated_discount numeric(12,2);
begin
  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order does not exist' using errcode = 'P0002';
  end if;

  select * into existing_redemption
  from public.promotion_redemptions
  where order_id = p_order_id;

  if found then
    if existing_redemption.code_snapshot <> normalized_code then
      raise exception 'Order already uses a different promotion'
        using errcode = 'P0001';
    end if;

    return jsonb_build_object(
      'promotionId', existing_redemption.promotion_id,
      'code', existing_redemption.code_snapshot,
      'discountAmount', existing_redemption.discount_amount,
      'subtotalAmount', existing_redemption.subtotal_amount,
      'totalAmount', existing_redemption.subtotal_amount - existing_redemption.discount_amount,
      'currency', existing_redemption.currency
    );
  end if;

  if normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
     or order_row.status not in ('awaiting_payment','confirmed') then
    raise exception 'Promotion code is invalid or unavailable' using errcode = 'P0001';
  end if;

  select count(distinct item.product_id)::integer
  into product_count
  from public.order_items item
  where item.order_id = p_order_id;

  if product_count <> 1 then
    raise exception 'Promotion requires a single-product order'
      using errcode = 'P0001';
  end if;

  select item.product_id
  into product_id
  from public.order_items item
  where item.order_id = p_order_id
  order by item.created_at, item.id
  limit 1;

  if product_id is null then
    raise exception 'Promotion order has no items' using errcode = 'P0001';
  end if;

  select promotion.*
  into promotion_row
  from public.promotions promotion
  where promotion.organization_id = order_row.organization_id
    and promotion.code = normalized_code
    and promotion.is_active
    and (promotion.venue_id is null or promotion.venue_id = order_row.venue_id)
    and (promotion.product_id is null or promotion.product_id = product_id)
    and (promotion.valid_from is null or promotion.valid_from <= statement_timestamp())
    and (promotion.valid_until is null or promotion.valid_until > statement_timestamp())
  for update;

  if not found then
    raise exception 'Promotion code is invalid or unavailable' using errcode = 'P0001';
  end if;

  if order_row.subtotal_amount < promotion_row.minimum_subtotal then
    raise exception 'Promotion minimum subtotal not reached' using errcode = 'P0001';
  end if;

  if promotion_row.discount_type = 'fixed'
     and promotion_row.currency <> order_row.currency then
    raise exception 'Promotion currency does not match order' using errcode = 'P0001';
  end if;

  customer_key := public.ticketing_promotion_customer_key(
    order_row.customer_user_id,
    order_row.customer_email
  );

  select count(*)::integer
  into total_uses
  from public.promotion_redemptions redemption
  join public.orders customer_order on customer_order.id = redemption.order_id
  where redemption.promotion_id = promotion_row.id
    and (
      customer_order.status in ('confirmed','partially_refunded','refunded')
      or (
        customer_order.status = 'awaiting_payment'
        and exists (
          select 1
          from public.inventory_holds hold
          where hold.order_id = customer_order.id
            and hold.status = 'active'
            and hold.expires_at > statement_timestamp()
        )
      )
    );

  if promotion_row.max_uses is not null and total_uses >= promotion_row.max_uses then
    raise exception 'Promotion usage limit reached' using errcode = 'P0001';
  end if;

  if promotion_row.max_uses_per_customer is not null then
    if customer_key is null then
      raise exception 'Promotion customer limit requires identity' using errcode = 'P0001';
    end if;

    select count(*)::integer
    into customer_uses
    from public.promotion_redemptions redemption
    join public.orders customer_order on customer_order.id = redemption.order_id
    where redemption.promotion_id = promotion_row.id
      and redemption.customer_key = customer_key
      and (
        customer_order.status in ('confirmed','partially_refunded','refunded')
        or (
          customer_order.status = 'awaiting_payment'
          and exists (
            select 1
            from public.inventory_holds hold
            where hold.order_id = customer_order.id
              and hold.status = 'active'
              and hold.expires_at > statement_timestamp()
          )
        )
      );

    if customer_uses >= promotion_row.max_uses_per_customer then
      raise exception 'Promotion customer usage limit reached' using errcode = 'P0001';
    end if;
  end if;

  calculated_discount := least(
    order_row.subtotal_amount,
    case
      when promotion_row.discount_type = 'percentage'
        then round(order_row.subtotal_amount * promotion_row.discount_value / 100, 2)
      else promotion_row.discount_value
    end
  );

  insert into public.promotion_redemptions (
    promotion_id,
    order_id,
    customer_key,
    code_snapshot,
    kind_snapshot,
    discount_type_snapshot,
    discount_value_snapshot,
    subtotal_amount,
    discount_amount,
    currency
  ) values (
    promotion_row.id,
    order_row.id,
    customer_key,
    promotion_row.code,
    promotion_row.kind,
    promotion_row.discount_type,
    promotion_row.discount_value,
    order_row.subtotal_amount,
    calculated_discount,
    order_row.currency
  );

  update public.orders customer_order
  set discount_amount = calculated_discount,
      total_amount = customer_order.subtotal_amount - calculated_discount,
      payment_status = case
        when customer_order.status = 'confirmed'
          and customer_order.subtotal_amount - calculated_discount = 0
          and customer_order.payment_status in ('unpaid','pending')
          then 'not_required'::public.ticketing_payment_status
        else customer_order.payment_status
      end,
      metadata = customer_order.metadata || jsonb_build_object(
        'promotion',
        jsonb_build_object(
          'promotion_id', promotion_row.id,
          'code', promotion_row.code,
          'kind', promotion_row.kind
        )
      )
  where id = order_row.id;

  return jsonb_build_object(
    'promotionId', promotion_row.id,
    'code', promotion_row.code,
    'name', promotion_row.name,
    'kind', promotion_row.kind,
    'discountAmount', calculated_discount,
    'subtotalAmount', order_row.subtotal_amount,
    'totalAmount', order_row.subtotal_amount - calculated_discount,
    'currency', order_row.currency
  );
end;
$$;

revoke all on function public.ticketing_apply_promotion_to_order(uuid,text)
from public, anon, authenticated;
grant execute on function public.ticketing_apply_promotion_to_order(uuid,text)
to service_role;

create or replace function public.ticketing_create_order_hold_with_promotion(
  p_checkout_key uuid,
  p_session_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_items jsonb,
  p_customer_user_id uuid default null,
  p_customer_phone text default null,
  p_source public.ticketing_order_source default 'enjoyhub_marketplace',
  p_hold_minutes integer default 15,
  p_terms_accepted boolean default false,
  p_metadata jsonb default '{}'::jsonb,
  p_promotion_code text default null
)
returns table (
  created_order_id uuid,
  created_order_number bigint,
  created_hold_token uuid,
  hold_expires_at timestamptz,
  created_subtotal_amount numeric(12,2),
  created_discount_amount numeric(12,2),
  created_total_amount numeric(12,2),
  created_currency text,
  reserved_capacity_units integer,
  available_capacity_units integer,
  current_hold_status public.ticketing_hold_status,
  current_order_status public.ticketing_order_status,
  applied_promotion_code text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  checkout_result record;
  promotion_result jsonb;
  existing_code text;
begin
  select * into checkout_result
  from public.ticketing_create_order_hold(
    p_checkout_key,
    p_session_id,
    p_customer_name,
    p_customer_email,
    p_items,
    p_customer_user_id,
    p_customer_phone,
    p_source,
    p_hold_minutes,
    p_terms_accepted,
    p_metadata
  );

  select redemption.code_snapshot
  into existing_code
  from public.promotion_redemptions redemption
  where redemption.order_id = checkout_result.created_order_id;

  if nullif(btrim(coalesce(p_promotion_code,'')), '') is null then
    if existing_code is not null then
      raise exception 'Checkout key already has a promotion' using errcode = 'P0001';
    end if;

    return query select
      checkout_result.created_order_id,
      checkout_result.created_order_number,
      checkout_result.created_hold_token,
      checkout_result.hold_expires_at,
      checkout_result.created_total_amount,
      0::numeric(12,2),
      checkout_result.created_total_amount,
      checkout_result.created_currency,
      checkout_result.reserved_capacity_units,
      checkout_result.available_capacity_units,
      checkout_result.current_hold_status,
      checkout_result.current_order_status,
      null::text;
    return;
  end if;

  promotion_result := public.ticketing_apply_promotion_to_order(
    checkout_result.created_order_id,
    p_promotion_code
  );

  return query select
    checkout_result.created_order_id,
    checkout_result.created_order_number,
    checkout_result.created_hold_token,
    checkout_result.hold_expires_at,
    (promotion_result ->> 'subtotalAmount')::numeric(12,2),
    (promotion_result ->> 'discountAmount')::numeric(12,2),
    (promotion_result ->> 'totalAmount')::numeric(12,2),
    checkout_result.created_currency,
    checkout_result.reserved_capacity_units,
    checkout_result.available_capacity_units,
    checkout_result.current_hold_status,
    checkout_result.current_order_status,
    promotion_result ->> 'code';
end;
$$;

revoke all on function public.ticketing_create_order_hold_with_promotion(
  uuid,uuid,text,text,jsonb,uuid,text,public.ticketing_order_source,integer,boolean,jsonb,text
) from public, anon, authenticated;
grant execute on function public.ticketing_create_order_hold_with_promotion(
  uuid,uuid,text,text,jsonb,uuid,text,public.ticketing_order_source,integer,boolean,jsonb,text
) to service_role;

create or replace function public.ticketing_confirm_zero_total_order(
  p_order_id uuid,
  p_hold_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  state record;
  confirmation_time timestamptz := statement_timestamp();
  ticket_count integer;
begin
  select
    customer_order.status as order_status,
    customer_order.payment_status,
    customer_order.total_amount,
    customer_order.marketplace_terms_version,
    customer_order.cancellation_policy_version,
    hold.status as hold_status,
    hold.expires_at
  into state
  from public.orders customer_order
  join public.inventory_holds hold on hold.order_id = customer_order.id
  where customer_order.id = p_order_id
    and hold.hold_token = p_hold_token
  for update of customer_order, hold;

  if not found then
    raise exception 'Order and hold token do not match' using errcode = 'P0002';
  end if;

  if state.order_status = 'confirmed'
     and state.payment_status = 'not_required'
     and state.hold_status = 'converted' then
    select count(*)::integer into ticket_count
    from public.tickets where order_id = p_order_id;

    return jsonb_build_object('orderId', p_order_id, 'ticketCount', ticket_count);
  end if;

  if state.total_amount <> 0
     or state.order_status <> 'awaiting_payment'
     or state.hold_status <> 'active'
     or state.expires_at <= confirmation_time
     or state.marketplace_terms_version is null
     or state.cancellation_policy_version is null then
    raise exception 'Zero-total order is not ready for confirmation'
      using errcode = 'P0001';
  end if;

  update public.inventory_holds
  set status = 'converted',
      converted_at = confirmation_time
  where order_id = p_order_id
    and hold_token = p_hold_token;

  update public.orders
  set status = 'confirmed',
      payment_status = 'not_required',
      confirmed_at = coalesce(confirmed_at, confirmation_time)
  where id = p_order_id;

  insert into public.tickets (
    order_id,
    order_item_id,
    sequence_number,
    metadata
  )
  select
    item.order_id,
    item.id,
    generated.sequence_number,
    jsonb_build_object('issued_by', 'promotion_zero_total')
  from public.order_items item
  cross join lateral generate_series(1, item.quantity) generated(sequence_number)
  where item.order_id = p_order_id
  on conflict (order_item_id, sequence_number) do nothing;

  select count(*)::integer into ticket_count
  from public.tickets where order_id = p_order_id;

  return jsonb_build_object('orderId', p_order_id, 'ticketCount', ticket_count);
end;
$$;

revoke all on function public.ticketing_confirm_zero_total_order(uuid,uuid)
from public, anon, authenticated;
grant execute on function public.ticketing_confirm_zero_total_order(uuid,uuid)
to service_role;

create or replace function public.ticketing_create_organizer_booking_with_promotion(
  p_session_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_booking_source text,
  p_payment_method text,
  p_mark_paid boolean default false,
  p_note text default null,
  p_promotion_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  booking_result jsonb;
  promotion_result jsonb;
begin
  booking_result := public.ticketing_create_organizer_booking(
    p_session_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_items,
    p_booking_source,
    p_payment_method,
    p_mark_paid,
    p_note
  );

  if nullif(btrim(coalesce(p_promotion_code,'')), '') is not null then
    promotion_result := public.ticketing_apply_promotion_to_order(
      (booking_result ->> 'orderId')::uuid,
      p_promotion_code
    );

    booking_result := booking_result || jsonb_build_object(
      'promotionCode', promotion_result ->> 'code',
      'discountAmount', (promotion_result ->> 'discountAmount')::numeric,
      'totalAmount', (promotion_result ->> 'totalAmount')::numeric
    );
  end if;

  return booking_result;
end;
$$;

revoke all on function public.ticketing_create_organizer_booking_with_promotion(
  uuid,text,text,text,jsonb,text,text,boolean,text,text
) from public, anon;
grant execute on function public.ticketing_create_organizer_booking_with_promotion(
  uuid,text,text,text,jsonb,text,text,boolean,text,text
) to authenticated, service_role;

commit;
