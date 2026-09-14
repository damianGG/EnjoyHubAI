-- Stripe Connect settlement ledger for the EnjoyHub marketplace.
--
-- Customer charges stay on the platform account. After the booked service ends,
-- EnjoyHub transfers the organizer share to the connected Stripe account. The
-- connected account uses a manual payout schedule, so a bank payout only starts
-- when an authorized organizer requests it from EnjoyHub.

alter table public.organizations
  add column if not exists platform_fee_bps integer not null default 1000
    check (platform_fee_bps between 0 and 5000);

create table if not exists public.organization_payment_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_account_id text not null unique check (char_length(provider_account_id) >= 8),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  card_payments_enabled boolean not null default false,
  transfers_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  payout_schedule_manual boolean not null default false,
  disabled_reason text,
  requirements_currently_due text[] not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_charge_id text not null unique,
  provider_transfer_id text unique,
  transfer_group text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 5000),
  platform_fee_amount_minor bigint not null check (platform_fee_amount_minor >= 0),
  organizer_amount_minor bigint not null check (organizer_amount_minor >= 0),
  service_ends_at timestamptz not null,
  eligible_at timestamptz not null,
  status text not null default 'pending_service' check (
    status in ('pending_service','transferred','payout_pending','paid_out','refunded','requires_review')
  ),
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gross_amount_minor = platform_fee_amount_minor + organizer_amount_minor),
  check (eligible_at >= service_ends_at),
  check (
    (
      status in ('transferred','payout_pending','paid_out')
      and provider_transfer_id is not null
      and transferred_at is not null
    )
    or status in ('pending_service','refunded','requires_review')
  )
);

create index if not exists marketplace_settlements_org_status_idx
  on public.marketplace_settlements(organization_id, status, eligible_at);
create index if not exists marketplace_settlements_release_idx
  on public.marketplace_settlements(eligible_at)
  where status = 'pending_service';

create table if not exists public.marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_payout_id text unique,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'creating' check (
    status in ('creating','pending','paid','failed','cancelled','requires_review')
  ),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    provider_payout_id is not null
    or status in ('creating','failed','requires_review')
  )
);

create index if not exists marketplace_payouts_org_created_idx
  on public.marketplace_payouts(organization_id, created_at desc);
create unique index if not exists marketplace_payouts_one_creating_per_org_currency_idx
  on public.marketplace_payouts(organization_id, currency)
  where status = 'creating';

create table if not exists public.marketplace_payout_items (
  payout_id uuid not null references public.marketplace_payouts(id) on delete restrict,
  settlement_id uuid not null unique references public.marketplace_settlements(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, settlement_id)
);

create trigger marketplace_organization_payment_accounts_updated_at
before update on public.organization_payment_accounts
for each row execute function public.ticketing_set_updated_at();

create trigger marketplace_settlements_updated_at
before update on public.marketplace_settlements
for each row execute function public.ticketing_set_updated_at();

create trigger marketplace_payouts_updated_at
before update on public.marketplace_payouts
for each row execute function public.ticketing_set_updated_at();

-- Atomically reserves whole settlements for one payout. Repeated requests while
-- Stripe is still creating the payout reuse the same internal payout ID, which
-- becomes the Stripe idempotency key.
create or replace function public.marketplace_prepare_payout(
  p_organization_id uuid,
  p_requested_by uuid,
  p_currency text,
  p_available_minor bigint
)
returns table (
  prepared_payout_id uuid,
  prepared_amount_minor bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_payout record;
  candidate record;
  selected_ids uuid[] := '{}'::uuid[];
  selected_total bigint := 0;
  new_payout_id uuid := gen_random_uuid();
  normalized_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if p_organization_id is null
     or p_requested_by is null
     or normalized_currency !~ '^[A-Z]{3}$'
     or p_available_minor is null
     or p_available_minor <= 0 then
    raise exception 'Complete payout preparation data is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || normalized_currency, 0));

  select payout.id, payout.amount_minor
    into existing_payout
    from public.marketplace_payouts payout
   where payout.organization_id = p_organization_id
     and payout.currency = normalized_currency
     and payout.status = 'creating'
   order by payout.created_at desc
   limit 1;

  if found then
    return query select existing_payout.id, existing_payout.amount_minor;
    return;
  end if;

  for candidate in
    select settlement.id, settlement.organizer_amount_minor
      from public.marketplace_settlements settlement
     where settlement.organization_id = p_organization_id
       and settlement.currency = normalized_currency
       and settlement.status = 'transferred'
     order by settlement.eligible_at, settlement.created_at, settlement.id
     for update
  loop
    if selected_total + candidate.organizer_amount_minor <= p_available_minor then
      selected_ids := array_append(selected_ids, candidate.id);
      selected_total := selected_total + candidate.organizer_amount_minor;
    end if;
  end loop;

  if selected_total <= 0 or cardinality(selected_ids) = 0 then
    raise exception 'No transferred funds are currently available for payout'
      using errcode = 'P0001';
  end if;

  insert into public.marketplace_payouts (
    id,
    organization_id,
    currency,
    amount_minor,
    status,
    requested_by
  ) values (
    new_payout_id,
    p_organization_id,
    normalized_currency,
    selected_total,
    'creating',
    p_requested_by
  );

  insert into public.marketplace_payout_items (payout_id, settlement_id, amount_minor)
  select new_payout_id, settlement.id, settlement.organizer_amount_minor
    from public.marketplace_settlements settlement
   where settlement.id = any(selected_ids);

  update public.marketplace_settlements
     set status = 'payout_pending'
   where id = any(selected_ids);

  return query select new_payout_id, selected_total;
end;
$$;

create or replace function public.marketplace_attach_payout_provider(
  p_payout_id uuid,
  p_provider_payout_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_payout_id is null or char_length(btrim(coalesce(p_provider_payout_id, ''))) < 4 then
    raise exception 'Payout and provider payout ID are required' using errcode = '22023';
  end if;

  update public.marketplace_payouts
     set provider_payout_id = btrim(p_provider_payout_id),
         status = 'pending',
         failure_code = null
   where id = p_payout_id
     and status = 'creating'
     and (provider_payout_id is null or provider_payout_id = btrim(p_provider_payout_id));

  if not found then
    raise exception 'Payout is not awaiting provider attachment' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.marketplace_fail_prepared_payout(
  p_payout_id uuid,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.marketplace_payouts
     set status = 'failed',
         failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'payout_create_failed'), 240)
   where id = p_payout_id
     and status = 'creating'
     and provider_payout_id is null;

  if found then
    update public.marketplace_settlements settlement
       set status = 'transferred'
      from public.marketplace_payout_items item
     where item.payout_id = p_payout_id
       and item.settlement_id = settlement.id
       and settlement.status = 'payout_pending';
  end if;
end;
$$;

create or replace function public.marketplace_apply_payout_event(
  p_provider_payout_id text,
  p_status text,
  p_paid_at timestamptz default null,
  p_failure_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payout_id uuid;
  normalized_status text := lower(btrim(coalesce(p_status, '')));
begin
  if char_length(btrim(coalesce(p_provider_payout_id, ''))) < 4
     or normalized_status not in ('pending','paid','failed','cancelled') then
    raise exception 'Valid payout event data is required' using errcode = '22023';
  end if;

  select payout.id
    into payout_id
    from public.marketplace_payouts payout
   where payout.provider_payout_id = btrim(p_provider_payout_id)
   for update;

  if payout_id is null then
    raise exception 'Provider payout is not registered' using errcode = 'P0002';
  end if;

  update public.marketplace_payouts
     set status = normalized_status,
         paid_at = case when normalized_status = 'paid' then coalesce(p_paid_at, now()) else paid_at end,
         failure_code = case
           when normalized_status in ('failed','cancelled') then left(coalesce(nullif(btrim(p_failure_code), ''), normalized_status), 240)
           else null
         end
   where id = payout_id;

  if normalized_status = 'paid' then
    update public.marketplace_settlements settlement
       set status = 'paid_out'
      from public.marketplace_payout_items item
     where item.payout_id = payout_id
       and item.settlement_id = settlement.id
       and settlement.status = 'payout_pending';
  elsif normalized_status in ('failed','cancelled') then
    update public.marketplace_settlements settlement
       set status = 'transferred'
      from public.marketplace_payout_items item
     where item.payout_id = payout_id
       and item.settlement_id = settlement.id
       and settlement.status = 'payout_pending';
  end if;

  return payout_id;
end;
$$;

alter table public.organization_payment_accounts enable row level security;
alter table public.marketplace_settlements enable row level security;
alter table public.marketplace_payouts enable row level security;
alter table public.marketplace_payout_items enable row level security;

create policy organization_payment_accounts_select_finance_admins
on public.organization_payment_accounts for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin']::public.ticketing_member_role[]
  )
);

create policy marketplace_settlements_select_org_sales
on public.marketplace_settlements for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  )
);

create policy marketplace_payouts_select_org_sales
on public.marketplace_payouts for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  )
);

create policy marketplace_payout_items_select_org_sales
on public.marketplace_payout_items for select to authenticated
using (
  exists (
    select 1
    from public.marketplace_payouts payout
    where payout.id = marketplace_payout_items.payout_id
      and public.ticketing_is_org_member(
        payout.organization_id,
        array['owner','admin','manager','viewer']::public.ticketing_member_role[]
      )
  )
);

revoke all privileges on table
  public.organization_payment_accounts,
  public.marketplace_settlements,
  public.marketplace_payouts,
  public.marketplace_payout_items
from public, anon, authenticated;

grant select on public.organization_payment_accounts,
  public.marketplace_settlements,
  public.marketplace_payouts,
  public.marketplace_payout_items
to authenticated;

grant all privileges on public.organization_payment_accounts,
  public.marketplace_settlements,
  public.marketplace_payouts,
  public.marketplace_payout_items
to service_role;

revoke all on function public.marketplace_prepare_payout(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.marketplace_attach_payout_provider(uuid, text) from public, anon, authenticated;
revoke all on function public.marketplace_fail_prepared_payout(uuid, text) from public, anon, authenticated;
revoke all on function public.marketplace_apply_payout_event(text, text, timestamptz, text) from public, anon, authenticated;

grant execute on function public.marketplace_prepare_payout(uuid, uuid, text, bigint) to service_role;
grant execute on function public.marketplace_attach_payout_provider(uuid, text) to service_role;
grant execute on function public.marketplace_fail_prepared_payout(uuid, text) to service_role;
grant execute on function public.marketplace_apply_payout_event(text, text, timestamptz, text) to service_role;

comment on column public.organizations.platform_fee_bps is
  'EnjoyHub marketplace commission snapshot source. 1000 = 10.00%.';
comment on table public.marketplace_settlements is
  'One immutable commercial split per paid order; organizer funds become transferable only after service_ends_at.';
comment on table public.marketplace_payouts is
  'Organizer-requested bank payouts created on the connected Stripe account.';
