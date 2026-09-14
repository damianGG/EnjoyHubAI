-- Marketplace refunds for paid EnjoyHub ticket orders.
--
-- Refunds are recorded before calling Stripe, applied idempotently from the
-- provider response/webhook, and keep organizer settlement accounting correct
-- for both pre-transfer and post-transfer refunds.

begin;

alter table public.marketplace_settlements
  add column if not exists refunded_amount_minor bigint not null default 0,
  add column if not exists platform_fee_refunded_minor bigint not null default 0,
  add column if not exists organizer_refunded_before_transfer_minor bigint not null default 0,
  add column if not exists organizer_recovered_minor bigint not null default 0,
  add column if not exists organizer_debt_minor bigint not null default 0,
  add column if not exists transferred_amount_minor bigint not null default 0;

update public.marketplace_settlements
   set transferred_amount_minor = organizer_amount_minor
 where provider_transfer_id is not null
   and transferred_amount_minor = 0
   and status in ('transferred', 'payout_pending', 'paid_out');

alter table public.marketplace_settlements
  drop constraint if exists marketplace_settlements_refunded_amount_check,
  drop constraint if exists marketplace_settlements_platform_fee_refunded_check,
  drop constraint if exists marketplace_settlements_organizer_refund_accounting_check,
  drop constraint if exists marketplace_settlements_transferred_amount_check;

alter table public.marketplace_settlements
  add constraint marketplace_settlements_refunded_amount_check
    check (refunded_amount_minor between 0 and gross_amount_minor),
  add constraint marketplace_settlements_platform_fee_refunded_check
    check (platform_fee_refunded_minor between 0 and platform_fee_amount_minor),
  add constraint marketplace_settlements_organizer_refund_accounting_check
    check (
      organizer_refunded_before_transfer_minor >= 0
      and organizer_recovered_minor >= 0
      and organizer_debt_minor >= 0
      and organizer_refunded_before_transfer_minor + organizer_recovered_minor + organizer_debt_minor <= organizer_amount_minor
    ),
  add constraint marketplace_settlements_transferred_amount_check
    check (transferred_amount_minor between 0 and organizer_amount_minor);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_refund_id text unique,
  provider_transfer_id text,
  provider_transfer_reversal_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  platform_fee_refund_minor bigint not null default 0 check (platform_fee_refund_minor >= 0),
  organizer_refund_minor bigint not null default 0 check (organizer_refund_minor >= 0),
  recovery_required_minor bigint not null default 0 check (recovery_required_minor >= 0),
  recovered_minor bigint not null default 0 check (recovered_minor >= 0),
  status text not null default 'creating' check (
    status in ('creating', 'pending', 'succeeded', 'failed', 'cancelled')
  ),
  recovery_status text not null default 'not_required' check (
    recovery_status in ('not_required', 'pending', 'reversed', 'debt', 'requires_review')
  ),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  requested_by uuid references auth.users(id) on delete set null,
  failure_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee_refund_minor + organizer_refund_minor <= amount_minor),
  check (recovery_required_minor <= organizer_refund_minor),
  check (recovered_minor <= recovery_required_minor)
);

create index if not exists payment_refunds_order_created_idx
  on public.payment_refunds(order_id, created_at desc);
create index if not exists payment_refunds_org_recovery_idx
  on public.payment_refunds(organization_id, recovery_status, created_at)
  where status = 'succeeded';
create unique index if not exists payment_refunds_one_inflight_per_order_idx
  on public.payment_refunds(order_id)
  where status in ('creating', 'pending');

create trigger payment_refunds_updated_at
before update on public.payment_refunds
for each row execute function public.ticketing_set_updated_at();

alter table public.payment_refunds enable row level security;

create policy payment_refunds_select_org_sales
on public.payment_refunds for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  )
);

revoke all privileges on table public.payment_refunds from public, anon, authenticated;
grant select on public.payment_refunds to authenticated;
grant all privileges on public.payment_refunds to service_role;

-- Prepare exactly one refund operation at a time for an order. Authorization is
-- intentionally limited to organization owner/admin because this is a financial
-- mutation, not an ordinary sales read.
create or replace function public.marketplace_prepare_refund(
  p_order_id uuid,
  p_requested_by uuid,
  p_amount_minor bigint,
  p_reason text
)
returns table (
  prepared_refund_id uuid,
  prepared_payment_attempt_id uuid,
  prepared_provider_payment_id text,
  prepared_provider_transfer_id text,
  prepared_amount_minor bigint,
  prepared_currency text,
  prepared_recovery_required_minor bigint
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  order_row record;
  attempt_row record;
  settlement_row record;
  active_refund record;
  already_refunded bigint := 0;
  remaining_amount bigint := 0;
  remaining_fee bigint := 0;
  fee_refund bigint := 0;
  organizer_refund bigint := 0;
  recovery_required bigint := 0;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  new_refund_id uuid := gen_random_uuid();
begin
  if actor_user_id is null or p_requested_by is null or actor_user_id <> p_requested_by then
    raise exception 'Authenticated refund requester is required' using errcode = '42501';
  end if;
  if p_order_id is null or p_amount_minor is null or p_amount_minor <= 0
     or char_length(normalized_reason) not between 3 and 500 then
    raise exception 'Valid refund amount and reason are required' using errcode = '22023';
  end if;

  select customer_order.id,
         customer_order.organization_id,
         customer_order.payment_status,
         customer_order.total_amount,
         customer_order.currency
    into order_row
    from public.orders customer_order
   where customer_order.id = p_order_id
   for update;

  if not found then
    raise exception 'Order does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    order_row.organization_id,
    array['owner','admin']::public.ticketing_member_role[]
  ) then
    raise exception 'Only organization owner or admin may refund an order' using errcode = '42501';
  end if;

  if order_row.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Only a paid order can be refunded' using errcode = 'P0001';
  end if;

  select attempt.id, attempt.provider_payment_id, attempt.currency
    into attempt_row
    from public.payment_attempts attempt
   where attempt.order_id = p_order_id
     and attempt.provider = 'stripe'
     and attempt.status = 'paid'
     and attempt.provider_payment_id is not null
   order by attempt.created_at desc
   limit 1;

  if not found then
    raise exception 'Paid Stripe payment is missing for this order' using errcode = 'P0001';
  end if;

  select refund.*
    into active_refund
    from public.payment_refunds refund
   where refund.order_id = p_order_id
     and refund.status in ('creating', 'pending')
   order by refund.created_at desc
   limit 1;

  if found then
    if active_refund.amount_minor <> p_amount_minor
       or active_refund.reason <> normalized_reason
       or active_refund.requested_by is distinct from p_requested_by then
      raise exception 'Another refund for this order is still in progress' using errcode = 'P0001';
    end if;

    return query select
      active_refund.id,
      active_refund.payment_attempt_id,
      attempt_row.provider_payment_id,
      active_refund.provider_transfer_id,
      active_refund.amount_minor,
      active_refund.currency,
      active_refund.recovery_required_minor;
    return;
  end if;

  select coalesce(sum(refund.amount_minor), 0)::bigint
    into already_refunded
    from public.payment_refunds refund
   where refund.order_id = p_order_id
     and refund.status = 'succeeded';

  remaining_amount := round(order_row.total_amount * 100)::bigint - already_refunded;
  if remaining_amount <= 0 then
    raise exception 'Order is already fully refunded' using errcode = 'P0001';
  end if;
  if p_amount_minor > remaining_amount then
    raise exception 'Refund exceeds the remaining paid amount' using errcode = '22003';
  end if;

  select settlement.id,
         settlement.status,
         settlement.platform_fee_bps,
         settlement.platform_fee_amount_minor,
         settlement.platform_fee_refunded_minor,
         settlement.provider_transfer_id
    into settlement_row
    from public.marketplace_settlements settlement
   where settlement.order_id = p_order_id
   for update;

  if found then
    remaining_fee := greatest(
      settlement_row.platform_fee_amount_minor - settlement_row.platform_fee_refunded_minor,
      0
    );
    if p_amount_minor = remaining_amount then
      fee_refund := least(remaining_fee, p_amount_minor);
    else
      fee_refund := least(
        remaining_fee,
        round(p_amount_minor * settlement_row.platform_fee_bps / 10000.0)::bigint
      );
    end if;
    organizer_refund := p_amount_minor - fee_refund;

    if settlement_row.provider_transfer_id is not null
       and settlement_row.status in ('transferred', 'payout_pending', 'paid_out') then
      recovery_required := organizer_refund;
    end if;
  end if;

  insert into public.payment_refunds (
    id,
    order_id,
    payment_attempt_id,
    organization_id,
    provider,
    provider_transfer_id,
    amount_minor,
    currency,
    platform_fee_refund_minor,
    organizer_refund_minor,
    recovery_required_minor,
    recovery_status,
    reason,
    requested_by
  ) values (
    new_refund_id,
    p_order_id,
    attempt_row.id,
    order_row.organization_id,
    'stripe',
    settlement_row.provider_transfer_id,
    p_amount_minor,
    upper(order_row.currency),
    fee_refund,
    organizer_refund,
    recovery_required,
    case when recovery_required > 0 then 'pending' else 'not_required' end,
    normalized_reason,
    p_requested_by
  );

  return query select
    new_refund_id,
    attempt_row.id,
    attempt_row.provider_payment_id,
    settlement_row.provider_transfer_id,
    p_amount_minor,
    upper(order_row.currency),
    recovery_required;
end;
$$;

-- Apply Stripe's refund state. The first transition to succeeded is the only
-- place that changes order/ticket/inventory and settlement accounting.
create or replace function public.marketplace_apply_refund_provider(
  p_refund_id uuid,
  p_provider_refund_id text,
  p_status text,
  p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refund_row public.payment_refunds%rowtype;
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  was_succeeded boolean := false;
  total_refunded bigint := 0;
  order_total_minor bigint := 0;
begin
  if p_refund_id is null
     or char_length(btrim(coalesce(p_provider_refund_id, ''))) < 4
     or normalized_status not in ('pending', 'succeeded', 'failed', 'cancelled') then
    raise exception 'Valid provider refund state is required' using errcode = '22023';
  end if;

  select * into refund_row
    from public.payment_refunds
   where id = p_refund_id
   for update;

  if not found then
    raise exception 'Refund does not exist' using errcode = 'P0002';
  end if;

  if refund_row.provider_refund_id is not null
     and refund_row.provider_refund_id <> btrim(p_provider_refund_id) then
    raise exception 'A different provider refund is already attached' using errcode = '23505';
  end if;

  was_succeeded := refund_row.status = 'succeeded';

  update public.payment_refunds
     set provider_refund_id = btrim(p_provider_refund_id),
         status = normalized_status,
         failure_code = case when normalized_status in ('failed', 'cancelled') then left(coalesce(nullif(btrim(p_failure_code), ''), normalized_status), 240) else null end,
         completed_at = case when normalized_status in ('succeeded', 'failed', 'cancelled') then coalesce(completed_at, now()) else completed_at end
   where id = p_refund_id;

  if normalized_status <> 'succeeded' or was_succeeded then
    return;
  end if;

  update public.marketplace_settlements
     set refunded_amount_minor = refunded_amount_minor + refund_row.amount_minor,
         platform_fee_refunded_minor = platform_fee_refunded_minor + refund_row.platform_fee_refund_minor,
         organizer_refunded_before_transfer_minor = organizer_refunded_before_transfer_minor +
           case when refund_row.recovery_required_minor = 0 then refund_row.organizer_refund_minor else 0 end,
         status = case
           when status = 'pending_service' and refunded_amount_minor + refund_row.amount_minor >= gross_amount_minor then 'refunded'
           else status
         end
   where order_id = refund_row.order_id;

  select coalesce(sum(refund.amount_minor), 0)::bigint
    into total_refunded
    from public.payment_refunds refund
   where refund.order_id = refund_row.order_id
     and refund.status = 'succeeded';

  select round(customer_order.total_amount * 100)::bigint
    into order_total_minor
    from public.orders customer_order
   where customer_order.id = refund_row.order_id
   for update;

  if total_refunded >= order_total_minor then
    update public.orders
       set payment_status = 'refunded',
           status = 'refunded'
     where id = refund_row.order_id;

    update public.tickets
       set status = 'void'
     where order_id = refund_row.order_id
       and status = 'valid';

    if not exists (
      select 1 from public.tickets
       where order_id = refund_row.order_id
         and status = 'used'
    ) then
      update public.inventory_holds
         set status = 'released'
       where order_id = refund_row.order_id
         and status = 'converted';
    end if;
  else
    update public.orders
       set payment_status = 'partially_refunded',
           status = 'partially_refunded'
     where id = refund_row.order_id;
  end if;
end;
$$;

create or replace function public.marketplace_fail_refund_creation(
  p_refund_id uuid,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.payment_refunds
     set status = 'failed',
         failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'refund_create_failed'), 240),
         completed_at = now()
   where id = p_refund_id
     and status = 'creating'
     and provider_refund_id is null;
end;
$$;

-- Record whether the organizer portion of a post-transfer refund was recovered
-- by reversing the Stripe transfer. A failed reversal becomes explicit debt and
-- blocks further bank payouts until recovery succeeds.
create or replace function public.marketplace_apply_refund_recovery(
  p_refund_id uuid,
  p_provider_transfer_reversal_id text,
  p_status text,
  p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refund_row public.payment_refunds%rowtype;
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  previous_status text;
begin
  if p_refund_id is null or normalized_status not in ('reversed', 'debt', 'requires_review') then
    raise exception 'Valid refund recovery state is required' using errcode = '22023';
  end if;

  select * into refund_row
    from public.payment_refunds
   where id = p_refund_id
   for update;

  if not found or refund_row.status <> 'succeeded' then
    raise exception 'Only a succeeded refund can recover organizer funds' using errcode = 'P0001';
  end if;
  if refund_row.recovery_required_minor <= 0 then
    return;
  end if;

  previous_status := refund_row.recovery_status;

  if normalized_status = 'reversed' then
    if char_length(btrim(coalesce(p_provider_transfer_reversal_id, ''))) < 4 then
      raise exception 'Provider reversal ID is required' using errcode = '22023';
    end if;
    if refund_row.provider_transfer_reversal_id is not null
       and refund_row.provider_transfer_reversal_id <> btrim(p_provider_transfer_reversal_id) then
      raise exception 'A different transfer reversal is already attached' using errcode = '23505';
    end if;
    if previous_status = 'reversed' then return; end if;

    update public.payment_refunds
       set provider_transfer_reversal_id = btrim(p_provider_transfer_reversal_id),
           recovered_minor = recovery_required_minor,
           recovery_status = 'reversed',
           failure_code = null
     where id = p_refund_id;

    update public.marketplace_settlements
       set organizer_recovered_minor = organizer_recovered_minor + refund_row.recovery_required_minor,
           organizer_debt_minor = greatest(
             organizer_debt_minor - case when previous_status = 'debt' then refund_row.recovery_required_minor else 0 end,
             0
           )
     where order_id = refund_row.order_id;
  elsif normalized_status = 'debt' then
    if previous_status = 'reversed' or previous_status = 'debt' then return; end if;

    update public.payment_refunds
       set recovery_status = 'debt',
           failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'organizer_recovery_failed'), 240)
     where id = p_refund_id;

    update public.marketplace_settlements
       set organizer_debt_minor = organizer_debt_minor + refund_row.recovery_required_minor
     where order_id = refund_row.order_id;
  else
    if previous_status = 'reversed' then return; end if;
    update public.payment_refunds
       set recovery_status = 'requires_review',
           failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'organizer_recovery_uncertain'), 240)
     where id = p_refund_id;
  end if;
end;
$$;

-- Payouts use the amount actually transferred to the connected account, net of
-- successful transfer reversals. Any unresolved refund debt blocks a new payout.
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
  outstanding_debt bigint := 0;
begin
  if p_organization_id is null
     or p_requested_by is null
     or normalized_currency !~ '^[A-Z]{3}$'
     or p_available_minor is null
     or p_available_minor <= 0 then
    raise exception 'Complete payout preparation data is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || normalized_currency, 0));

  select coalesce(sum(settlement.organizer_debt_minor), 0)::bigint
    into outstanding_debt
    from public.marketplace_settlements settlement
   where settlement.organization_id = p_organization_id
     and settlement.currency = normalized_currency;

  if outstanding_debt > 0 then
    raise exception 'Organizer has unresolved refund recovery debt' using errcode = 'P0001';
  end if;

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
    select settlement.id,
           greatest(settlement.transferred_amount_minor - settlement.organizer_recovered_minor, 0)::bigint as payable_minor
      from public.marketplace_settlements settlement
     where settlement.organization_id = p_organization_id
       and settlement.currency = normalized_currency
       and settlement.status = 'transferred'
     order by settlement.eligible_at, settlement.created_at, settlement.id
     for update
  loop
    if candidate.payable_minor > 0
       and selected_total + candidate.payable_minor <= p_available_minor then
      selected_ids := array_append(selected_ids, candidate.id);
      selected_total := selected_total + candidate.payable_minor;
    end if;
  end loop;

  if selected_total <= 0 or cardinality(selected_ids) = 0 then
    raise exception 'No transferred funds are currently available for payout' using errcode = 'P0001';
  end if;

  insert into public.marketplace_payouts (
    id, organization_id, currency, amount_minor, status, requested_by
  ) values (
    new_payout_id, p_organization_id, normalized_currency, selected_total, 'creating', p_requested_by
  );

  insert into public.marketplace_payout_items (payout_id, settlement_id, amount_minor)
  select new_payout_id,
         settlement.id,
         greatest(settlement.transferred_amount_minor - settlement.organizer_recovered_minor, 0)::bigint
    from public.marketplace_settlements settlement
   where settlement.id = any(selected_ids);

  update public.marketplace_settlements
     set status = 'payout_pending'
   where id = any(selected_ids);

  return query select new_payout_id, selected_total;
end;
$$;

revoke all on function public.marketplace_prepare_refund(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.marketplace_prepare_refund(uuid, uuid, bigint, text) to authenticated, service_role;

revoke all on function public.marketplace_apply_refund_provider(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.marketplace_fail_refund_creation(uuid, text) from public, anon, authenticated;
revoke all on function public.marketplace_apply_refund_recovery(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.marketplace_apply_refund_provider(uuid, text, text, text) to service_role;
grant execute on function public.marketplace_fail_refund_creation(uuid, text) to service_role;
grant execute on function public.marketplace_apply_refund_recovery(uuid, text, text, text) to service_role;

comment on table public.payment_refunds is
  'Idempotent full/partial customer refunds and organizer recovery state for marketplace orders.';
comment on column public.marketplace_settlements.organizer_debt_minor is
  'Organizer share already refunded to the customer but not yet recovered from the connected account.';

commit;
