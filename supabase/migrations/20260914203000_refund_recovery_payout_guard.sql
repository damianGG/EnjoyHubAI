-- Never let an organizer withdraw more money while a post-transfer refund still
-- needs to be recovered or reconciled.

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
  unresolved_recovery boolean := false;
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

  select exists (
    select 1
      from public.payment_refunds refund
     where refund.organization_id = p_organization_id
       and refund.currency = normalized_currency
       and refund.status = 'succeeded'
       and refund.recovery_required_minor > 0
       and refund.recovery_status in ('pending', 'debt', 'requires_review')
  ) into unresolved_recovery;

  if outstanding_debt > 0 or unresolved_recovery then
    raise exception 'Organizer has unresolved refund recovery' using errcode = 'P0001';
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
