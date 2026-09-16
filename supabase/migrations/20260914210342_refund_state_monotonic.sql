-- Stripe webhook delivery order is not guaranteed. Never let a late pending or
-- failed event downgrade a refund that has already succeeded and changed order,
-- ticket, inventory and settlement state.

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

  -- Terminal states are monotonic. In particular, an out-of-order refund.created
  -- event must never move a succeeded refund back to pending.
  if refund_row.status = 'succeeded' then
    update public.payment_refunds
       set provider_refund_id = coalesce(provider_refund_id, btrim(p_provider_refund_id))
     where id = p_refund_id;
    return;
  end if;

  if refund_row.status in ('failed', 'cancelled') then
    return;
  end if;

  update public.payment_refunds
     set provider_refund_id = btrim(p_provider_refund_id),
         status = normalized_status,
         failure_code = case
           when normalized_status in ('failed', 'cancelled') then left(coalesce(nullif(btrim(p_failure_code), ''), normalized_status), 240)
           else null
         end,
         completed_at = case
           when normalized_status in ('succeeded', 'failed', 'cancelled') then coalesce(completed_at, now())
           else completed_at
         end
   where id = p_refund_id;

  if normalized_status <> 'succeeded' then
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
