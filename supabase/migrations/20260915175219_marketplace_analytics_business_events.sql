create or replace function public.analytics_enrich_event(
  p_dedupe_key text,
  p_anonymous_id uuid default null,
  p_user_id uuid default null,
  p_analytics_session_id uuid default null,
  p_search_id uuid default null,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null,
  p_referrer text default null,
  p_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.analytics_events e set
    anonymous_id=coalesce(e.anonymous_id,p_anonymous_id),
    user_id=coalesce(e.user_id,p_user_id),
    analytics_session_id=coalesce(e.analytics_session_id,p_analytics_session_id),
    search_id=coalesce(e.search_id,p_search_id),
    source=coalesce(e.source,left(nullif(p_source,''),120)),
    medium=coalesce(e.medium,left(nullif(p_medium,''),120)),
    campaign=coalesce(e.campaign,left(nullif(p_campaign,''),160)),
    referrer=coalesce(e.referrer,left(nullif(p_referrer,''),500)),
    path=coalesce(e.path,left(nullif(p_path,''),500))
  where e.dedupe_key=p_dedupe_key
  returning e.id into v_id;
  return v_id;
end;
$$;
revoke all on function public.analytics_enrich_event(text,uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.analytics_enrich_event(text,uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.analytics_capture_order_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' and new.source::text='enjoyhub_marketplace' then
    perform public.analytics_record_event(
      p_event_name=>'order_created',p_occurred_at=>new.created_at,p_user_id=>new.customer_user_id,
      p_order_id=>new.id,p_value_amount=>new.total_amount,p_currency=>new.currency,
      p_properties=>jsonb_build_object('orderNumber',new.order_number),p_dedupe_key=>'order_created:'||new.id::text
    );
  elsif tg_op='UPDATE' and new.source::text='enjoyhub_marketplace' and new.status::text='confirmed' and new.payment_status::text='paid'
    and (old.status::text is distinct from 'confirmed' or old.payment_status::text is distinct from 'paid') then
    perform public.analytics_record_event(
      p_event_name=>'payment_completed',p_occurred_at=>coalesce(new.confirmed_at,now()),p_user_id=>new.customer_user_id,
      p_order_id=>new.id,p_value_amount=>new.total_amount,p_currency=>new.currency,
      p_properties=>jsonb_build_object('orderNumber',new.order_number),p_dedupe_key=>'payment_completed:'||new.id::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.analytics_capture_ticket_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.used_at is not null and old.used_at is null then
    perform public.analytics_record_event(
      p_event_name=>'ticket_redeemed',p_occurred_at=>new.used_at,p_order_id=>new.order_id,
      p_properties=>jsonb_build_object('ticketId',new.id),p_dedupe_key=>'ticket_redeemed:'||new.id::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.analytics_capture_review_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(new.verified_visit,false) then
    perform public.analytics_record_event(
      p_event_name=>'review_submitted',p_occurred_at=>new.created_at,p_user_id=>new.guest_id,
      p_attraction_id=>new.property_id,p_order_id=>new.ticketing_order_id,
      p_properties=>jsonb_build_object('rating',new.rating,'verified',true),p_dedupe_key=>'review_submitted:'||new.id::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.analytics_capture_demand_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    perform public.analytics_record_event(
      p_event_name=>'demand_created',p_occurred_at=>new.created_at,p_user_id=>new.user_id,p_attraction_id=>new.attraction_id,
      p_properties=>jsonb_build_object('partySize',new.party_size,'desiredDate',new.desired_date,'intent',new.intent,'source',new.source),
      p_dedupe_key=>'demand_created:'||new.id::text
    );
  else
    if new.notified_at is not null and old.notified_at is null then
      perform public.analytics_record_event(
        p_event_name=>'demand_notified',p_occurred_at=>new.notified_at,p_user_id=>new.user_id,p_attraction_id=>new.attraction_id,
        p_properties=>jsonb_build_object('partySize',new.party_size),p_dedupe_key=>'demand_notified:'||new.id::text
      );
    end if;
    if new.converted_at is not null and old.converted_at is null then
      perform public.analytics_record_event(
        p_event_name=>'demand_converted',p_occurred_at=>new.converted_at,p_user_id=>new.user_id,p_attraction_id=>new.attraction_id,
        p_order_id=>new.conversion_order_id,p_properties=>jsonb_build_object('partySize',new.party_size),p_dedupe_key=>'demand_converted:'||new.id::text
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.analytics_capture_refund_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_delta bigint;
begin
  v_delta:=coalesce(new.refunded_amount_minor,0)-coalesce(old.refunded_amount_minor,0);
  if v_delta>0 then
    perform public.analytics_record_event(
      p_event_name=>'refund_completed',p_occurred_at=>now(),p_order_id=>new.order_id,
      p_value_amount=>v_delta::numeric/100,p_currency=>new.currency,
      p_properties=>jsonb_build_object('refundMinor',v_delta,'settlementId',new.id),
      p_dedupe_key=>'refund_completed:'||new.id::text||':'||coalesce(new.refunded_amount_minor,0)::text
    );
  end if;
  return new;
end;
$$;

revoke all on function public.analytics_capture_order_event() from public,anon,authenticated;
revoke all on function public.analytics_capture_ticket_event() from public,anon,authenticated;
revoke all on function public.analytics_capture_review_event() from public,anon,authenticated;
revoke all on function public.analytics_capture_demand_event() from public,anon,authenticated;
revoke all on function public.analytics_capture_refund_event() from public,anon,authenticated;

drop trigger if exists analytics_orders_trigger on public.orders;
create trigger analytics_orders_trigger after insert or update on public.orders for each row execute function public.analytics_capture_order_event();
drop trigger if exists analytics_tickets_trigger on public.tickets;
create trigger analytics_tickets_trigger after update of used_at on public.tickets for each row execute function public.analytics_capture_ticket_event();
drop trigger if exists analytics_reviews_trigger on public.reviews;
create trigger analytics_reviews_trigger after insert on public.reviews for each row execute function public.analytics_capture_review_event();
drop trigger if exists analytics_demand_trigger on public.attraction_demand_requests;
create trigger analytics_demand_trigger after insert or update of notified_at,converted_at on public.attraction_demand_requests for each row execute function public.analytics_capture_demand_event();
drop trigger if exists analytics_settlement_refund_trigger on public.marketplace_settlements;
create trigger analytics_settlement_refund_trigger after update of refunded_amount_minor on public.marketplace_settlements for each row execute function public.analytics_capture_refund_event();
