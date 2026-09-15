create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  anonymous_id uuid,
  user_id uuid,
  analytics_session_id uuid,
  search_id uuid,
  attraction_id uuid,
  organization_id uuid,
  product_id uuid,
  ticketing_session_id uuid,
  order_id uuid,
  source text,
  medium text,
  campaign text,
  referrer text,
  path text,
  value_amount numeric(14,2),
  currency text,
  properties jsonb not null default '{}'::jsonb,
  dedupe_key text,
  constraint analytics_events_name_check check (event_name = any (array[
    'search_performed','search_result_clicked','attraction_viewed','availability_viewed',
    'session_selected','checkout_started','order_created','payment_started','payment_completed',
    'ticket_redeemed','review_submitted','demand_created','demand_notified','demand_converted',
    'refund_requested','refund_completed'
  ]::text[])),
  constraint analytics_events_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint analytics_events_currency_check check (currency is null or currency ~ '^[A-Z]{3}$')
);

create unique index if not exists analytics_events_dedupe_key_idx
  on public.analytics_events(dedupe_key) where dedupe_key is not null;
create index if not exists analytics_events_occurred_at_idx on public.analytics_events(occurred_at desc);
create index if not exists analytics_events_event_time_idx on public.analytics_events(event_name, occurred_at desc);
create index if not exists analytics_events_search_idx on public.analytics_events(search_id, occurred_at desc) where search_id is not null;
create index if not exists analytics_events_attraction_idx on public.analytics_events(attraction_id, occurred_at desc) where attraction_id is not null;
create index if not exists analytics_events_organization_idx on public.analytics_events(organization_id, occurred_at desc) where organization_id is not null;
create index if not exists analytics_events_order_idx on public.analytics_events(order_id, occurred_at desc) where order_id is not null;

create table if not exists public.analytics_search_results (
  search_id uuid not null,
  attraction_id uuid not null,
  organization_id uuid,
  position smallint not null check (position between 1 and 100),
  occurred_at timestamptz not null default now(),
  primary key(search_id, attraction_id)
);
create index if not exists analytics_search_results_attraction_idx on public.analytics_search_results(attraction_id, occurred_at desc);
create index if not exists analytics_search_results_organization_idx on public.analytics_search_results(organization_id, occurred_at desc) where organization_id is not null;

create table if not exists public.analytics_daily_marketplace (
  day date not null,
  event_name text not null,
  currency text not null default '',
  event_count bigint not null default 0,
  value_amount numeric(16,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key(day, event_name, currency)
);

create table if not exists public.analytics_daily_attractions (
  day date not null,
  attraction_id uuid not null,
  organization_id uuid,
  impressions bigint not null default 0,
  search_clicks bigint not null default 0,
  views bigint not null default 0,
  availability_views bigint not null default 0,
  session_selections bigint not null default 0,
  checkout_starts bigint not null default 0,
  orders_created bigint not null default 0,
  paid_orders bigint not null default 0,
  tickets_redeemed bigint not null default 0,
  reviews_submitted bigint not null default 0,
  gross_amount numeric(16,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key(day, attraction_id)
);
create index if not exists analytics_daily_attractions_org_day_idx on public.analytics_daily_attractions(organization_id, day desc) where organization_id is not null;

alter table public.analytics_events enable row level security;
alter table public.analytics_search_results enable row level security;
alter table public.analytics_daily_marketplace enable row level security;
alter table public.analytics_daily_attractions enable row level security;

revoke all on table public.analytics_events from public, anon, authenticated;
revoke all on table public.analytics_search_results from public, anon, authenticated;
revoke all on table public.analytics_daily_marketplace from public, anon, authenticated;
revoke all on table public.analytics_daily_attractions from public, anon, authenticated;
grant select, insert, update on table public.analytics_events to service_role;
grant select, insert, update on table public.analytics_search_results to service_role;
grant select, insert, update on table public.analytics_daily_marketplace to service_role;
grant select, insert, update on table public.analytics_daily_attractions to service_role;

create or replace function public.analytics_rollup_event()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.analytics_daily_marketplace(day,event_name,currency,event_count,value_amount,updated_at)
  values ((new.occurred_at at time zone 'Europe/Warsaw')::date,new.event_name,coalesce(new.currency,''),1,coalesce(new.value_amount,0),now())
  on conflict (day,event_name,currency) do update set
    event_count=public.analytics_daily_marketplace.event_count+1,
    value_amount=public.analytics_daily_marketplace.value_amount+excluded.value_amount,
    updated_at=now();

  if new.attraction_id is not null then
    insert into public.analytics_daily_attractions(
      day,attraction_id,organization_id,search_clicks,views,availability_views,session_selections,
      checkout_starts,orders_created,paid_orders,tickets_redeemed,reviews_submitted,gross_amount,updated_at
    ) values (
      (new.occurred_at at time zone 'Europe/Warsaw')::date,new.attraction_id,new.organization_id,
      case when new.event_name='search_result_clicked' then 1 else 0 end,
      case when new.event_name='attraction_viewed' then 1 else 0 end,
      case when new.event_name='availability_viewed' then 1 else 0 end,
      case when new.event_name='session_selected' then 1 else 0 end,
      case when new.event_name='checkout_started' then 1 else 0 end,
      case when new.event_name='order_created' then 1 else 0 end,
      case when new.event_name='payment_completed' then 1 else 0 end,
      case when new.event_name='ticket_redeemed' then 1 else 0 end,
      case when new.event_name='review_submitted' then 1 else 0 end,
      case when new.event_name='payment_completed' then coalesce(new.value_amount,0) else 0 end,
      now()
    ) on conflict (day,attraction_id) do update set
      organization_id=coalesce(public.analytics_daily_attractions.organization_id,excluded.organization_id),
      search_clicks=public.analytics_daily_attractions.search_clicks+excluded.search_clicks,
      views=public.analytics_daily_attractions.views+excluded.views,
      availability_views=public.analytics_daily_attractions.availability_views+excluded.availability_views,
      session_selections=public.analytics_daily_attractions.session_selections+excluded.session_selections,
      checkout_starts=public.analytics_daily_attractions.checkout_starts+excluded.checkout_starts,
      orders_created=public.analytics_daily_attractions.orders_created+excluded.orders_created,
      paid_orders=public.analytics_daily_attractions.paid_orders+excluded.paid_orders,
      tickets_redeemed=public.analytics_daily_attractions.tickets_redeemed+excluded.tickets_redeemed,
      reviews_submitted=public.analytics_daily_attractions.reviews_submitted+excluded.reviews_submitted,
      gross_amount=public.analytics_daily_attractions.gross_amount+excluded.gross_amount,
      updated_at=now();
  end if;
  return new;
end;
$$;

create or replace function public.analytics_rollup_search_result()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.analytics_daily_attractions(day,attraction_id,organization_id,impressions,updated_at)
  values ((new.occurred_at at time zone 'Europe/Warsaw')::date,new.attraction_id,new.organization_id,1,now())
  on conflict (day,attraction_id) do update set
    organization_id=coalesce(public.analytics_daily_attractions.organization_id,excluded.organization_id),
    impressions=public.analytics_daily_attractions.impressions+1,updated_at=now();
  return new;
end;
$$;

drop trigger if exists analytics_events_rollup_trigger on public.analytics_events;
create trigger analytics_events_rollup_trigger after insert on public.analytics_events for each row execute function public.analytics_rollup_event();
drop trigger if exists analytics_search_results_rollup_trigger on public.analytics_search_results;
create trigger analytics_search_results_rollup_trigger after insert on public.analytics_search_results for each row execute function public.analytics_rollup_search_result();
revoke all on function public.analytics_rollup_event() from public,anon,authenticated;
revoke all on function public.analytics_rollup_search_result() from public,anon,authenticated;

create or replace function public.analytics_record_event(
  p_event_name text,p_occurred_at timestamptz default now(),p_anonymous_id uuid default null,p_user_id uuid default null,
  p_analytics_session_id uuid default null,p_search_id uuid default null,p_attraction_id uuid default null,p_product_id uuid default null,
  p_ticketing_session_id uuid default null,p_order_id uuid default null,p_source text default null,p_medium text default null,
  p_campaign text default null,p_referrer text default null,p_path text default null,p_value_amount numeric default null,
  p_currency text default null,p_properties jsonb default '{}'::jsonb,p_dedupe_key text default null,p_search_results jsonb default '[]'::jsonb
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_event_id uuid; v_attraction_id uuid:=p_attraction_id; v_product_id uuid:=p_product_id;
  v_session_id uuid:=p_ticketing_session_id; v_order_id uuid:=p_order_id; v_organization_id uuid; v_venue_id uuid;
  v_previous public.analytics_events%rowtype; v_result jsonb; v_result_attraction uuid; v_result_org uuid; v_position integer;
begin
  if p_event_name is null or p_event_name <> all(array['search_performed','search_result_clicked','attraction_viewed','availability_viewed','session_selected','checkout_started','order_created','payment_started','payment_completed','ticket_redeemed','review_submitted','demand_created','demand_notified','demand_converted','refund_requested','refund_completed']::text[]) then raise exception 'Unsupported analytics event'; end if;
  if p_properties is null or jsonb_typeof(p_properties)<>'object' or pg_column_size(p_properties)>16384 then raise exception 'Invalid analytics properties'; end if;

  if v_order_id is not null then
    select o.organization_id,o.venue_id into v_organization_id,v_venue_id from public.orders o where o.id=v_order_id;
    if v_product_id is null or v_session_id is null or v_attraction_id is null then
      select oi.product_id,oi.session_id,pr.attraction_id into v_product_id,v_session_id,v_attraction_id
      from public.order_items oi left join public.products pr on pr.id=oi.product_id
      where oi.order_id=v_order_id order by oi.created_at asc limit 1;
    end if;
  end if;
  if v_session_id is not null and (v_product_id is null or v_attraction_id is null or v_organization_id is null) then
    select s.product_id,pr.attraction_id,v.organization_id,v.id into v_product_id,v_attraction_id,v_organization_id,v_venue_id
    from public.sessions s join public.products pr on pr.id=s.product_id join public.venues v on v.id=pr.venue_id where s.id=v_session_id;
  end if;
  if v_product_id is not null and (v_attraction_id is null or v_organization_id is null) then
    select pr.attraction_id,v.organization_id,v.id into v_attraction_id,v_organization_id,v_venue_id
    from public.products pr join public.venues v on v.id=pr.venue_id where pr.id=v_product_id;
  end if;
  if v_attraction_id is not null and v_organization_id is null then
    select v.organization_id,v.id into v_organization_id,v_venue_id from public.properties p
    left join public.venues v on v.id=p.venue_id or v.property_id=p.id where p.id=v_attraction_id
    order by case when v.id=p.venue_id then 0 else 1 end limit 1;
  end if;
  if v_order_id is not null then
    select e.* into v_previous from public.analytics_events e where e.order_id=v_order_id
      and (e.anonymous_id is not null or e.analytics_session_id is not null or e.search_id is not null)
    order by e.occurred_at asc limit 1;
    p_anonymous_id:=coalesce(p_anonymous_id,v_previous.anonymous_id); p_user_id:=coalesce(p_user_id,v_previous.user_id);
    p_analytics_session_id:=coalesce(p_analytics_session_id,v_previous.analytics_session_id); p_search_id:=coalesce(p_search_id,v_previous.search_id);
    p_source:=coalesce(nullif(p_source,''),v_previous.source); p_medium:=coalesce(nullif(p_medium,''),v_previous.medium); p_campaign:=coalesce(nullif(p_campaign,''),v_previous.campaign);
  end if;

  insert into public.analytics_events(event_name,occurred_at,anonymous_id,user_id,analytics_session_id,search_id,attraction_id,organization_id,product_id,ticketing_session_id,order_id,source,medium,campaign,referrer,path,value_amount,currency,properties,dedupe_key)
  values (p_event_name,coalesce(p_occurred_at,now()),p_anonymous_id,p_user_id,p_analytics_session_id,p_search_id,v_attraction_id,v_organization_id,v_product_id,v_session_id,v_order_id,left(nullif(p_source,''),120),left(nullif(p_medium,''),120),left(nullif(p_campaign,''),160),left(nullif(p_referrer,''),500),left(nullif(p_path,''),500),p_value_amount,case when p_currency is null then null else upper(left(p_currency,3)) end,p_properties,p_dedupe_key)
  on conflict (dedupe_key) where dedupe_key is not null do nothing returning id into v_event_id;
  if v_event_id is null and p_dedupe_key is not null then select id into v_event_id from public.analytics_events where dedupe_key=p_dedupe_key; end if;

  if p_event_name='search_performed' and p_search_id is not null and p_search_results is not null and jsonb_typeof(p_search_results)='array' and jsonb_array_length(p_search_results)<=50 then
    for v_result in select value from jsonb_array_elements(p_search_results) loop
      begin v_result_attraction:=(v_result->>'attractionId')::uuid; v_position:=(v_result->>'position')::integer; exception when others then continue; end;
      if v_position<1 or v_position>50 then continue; end if;
      select v.organization_id into v_result_org from public.properties p left join public.venues v on v.id=p.venue_id or v.property_id=p.id
      where p.id=v_result_attraction order by case when v.id=p.venue_id then 0 else 1 end limit 1;
      insert into public.analytics_search_results(search_id,attraction_id,organization_id,position,occurred_at)
      values(p_search_id,v_result_attraction,v_result_org,v_position,coalesce(p_occurred_at,now())) on conflict(search_id,attraction_id) do nothing;
    end loop;
  end if;
  return v_event_id;
end;
$$;
revoke all on function public.analytics_record_event(text,timestamptz,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,numeric,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.analytics_record_event(text,timestamptz,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,numeric,text,jsonb,text,jsonb) to service_role;

create or replace function public.analytics_platform_dashboard(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_role public.platform_staff_role:=public.platform_current_staff_role();
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_from timestamptz:=date_trunc('day',now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'-(greatest(1,least(coalesce(p_days,30),365))-1)*interval '1 day';
  v_from_date date:=(v_from at time zone 'Europe/Warsaw')::date; v_can_finance boolean; v_can_funnel boolean; v_can_search boolean; v_can_demand boolean; v_result jsonb;
begin
  if auth.uid() is null or v_role is null then raise exception 'Platform staff access required' using errcode='42501'; end if;
  v_can_finance:=v_role in ('platform_superadmin','platform_finance');
  v_can_funnel:=v_role in ('platform_superadmin','platform_support','platform_finance');
  v_can_search:=v_role in ('platform_superadmin','platform_support','platform_content');
  v_can_demand:=v_role in ('platform_superadmin','platform_support','platform_content');
  select jsonb_build_object(
    'role',v_role::text,'days',v_days,'from',v_from,'trackedFrom',(select min(occurred_at) from public.analytics_events),
    'permissions',jsonb_build_object('finance',v_can_finance,'funnel',v_can_funnel,'search',v_can_search,'demand',v_can_demand),
    'finance',case when v_can_finance then (select jsonb_build_object(
      'paidOrders',count(*) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),
      'gmv',coalesce(sum(o.total_amount) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),0),
      'averageOrderValue',coalesce(avg(o.total_amount) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),0),
      'currency',coalesce(min(o.currency) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),'PLN'),
      'ticketsSold',(select count(*) from public.tickets t join public.orders ot on ot.id=t.order_id where ot.confirmed_at>=v_from and ot.status::text='confirmed' and ot.payment_status::text='paid'),
      'platformFeeMinor',(select coalesce(sum(ms.platform_fee_amount_minor-ms.platform_fee_refunded_minor),0) from public.marketplace_settlements ms where ms.created_at>=v_from),
      'refundedMinor',(select coalesce(sum(ms.refunded_amount_minor),0) from public.marketplace_settlements ms where ms.created_at>=v_from),
      'pendingSettlementMinor',(select coalesce(sum(ms.organizer_amount_minor-ms.organizer_refunded_before_transfer_minor),0) from public.marketplace_settlements ms where ms.created_at>=v_from and ms.status<>'transferred')
    ) from public.orders o where coalesce(o.confirmed_at,o.created_at)>=v_from) else null end,
    'funnel',case when v_can_funnel then (select coalesce(jsonb_object_agg(event_name,event_count),'{}'::jsonb) from (select event_name,sum(event_count)::bigint event_count from public.analytics_daily_marketplace where day>=v_from_date and event_name in ('search_performed','search_result_clicked','attraction_viewed','availability_viewed','session_selected','checkout_started','order_created','payment_completed','ticket_redeemed','review_submitted') group by event_name) q) else null end,
    'search',case when v_can_search then jsonb_build_object(
      'searches',(select count(*) from public.analytics_events e where e.event_name='search_performed' and e.occurred_at>=v_from),
      'zeroResults',(select count(*) from public.analytics_events e where e.event_name='search_performed' and e.occurred_at>=v_from and coalesce((e.properties->>'resultCount')::integer,0)=0),
      'topQueries',coalesce((select jsonb_agg(row_to_json(q)) from (select coalesce(nullif(lower(trim(e.properties->>'query')),''),'(bez frazy)') query,count(*)::bigint searches,sum(case when coalesce((e.properties->>'resultCount')::integer,0)=0 then 1 else 0 end)::bigint zero_results from public.analytics_events e where e.event_name='search_performed' and e.occurred_at>=v_from group by 1 order by count(*) desc limit 12) q),'[]'::jsonb),
      'topZeroResultQueries',coalesce((select jsonb_agg(row_to_json(q)) from (select coalesce(nullif(lower(trim(e.properties->>'query')),''),'(bez frazy)') query,count(*)::bigint searches from public.analytics_events e where e.event_name='search_performed' and e.occurred_at>=v_from and coalesce((e.properties->>'resultCount')::integer,0)=0 group by 1 order by count(*) desc limit 12) q),'[]'::jsonb)
    ) else null end,
    'demand',case when v_can_demand then (select jsonb_build_object('requests',count(*),'people',coalesce(sum(party_size),0),'notified',count(*) filter(where notified_at is not null),'converted',count(*) filter(where converted_at is not null),'open',count(*) filter(where converted_at is null and closed_at is null)) from public.attraction_demand_requests where created_at>=v_from) else null end,
    'topAttractions',case when v_can_funnel then coalesce((select jsonb_agg(row_to_json(q)) from (select a.attraction_id,coalesce(p.title,'Atrakcja') title,sum(a.impressions)::bigint impressions,sum(a.search_clicks)::bigint search_clicks,sum(a.views)::bigint views,sum(a.checkout_starts)::bigint checkout_starts,sum(a.paid_orders)::bigint paid_orders,sum(a.gross_amount)::numeric tracked_gmv from public.analytics_daily_attractions a left join public.properties p on p.id=a.attraction_id where a.day>=v_from_date group by a.attraction_id,p.title order by sum(a.paid_orders) desc,sum(a.views) desc limit 15) q),'[]'::jsonb) else null end
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.analytics_platform_dashboard(integer) from public,anon;
grant execute on function public.analytics_platform_dashboard(integer) to authenticated;

create or replace function public.analytics_organizer_dashboard(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_from timestamptz:=date_trunc('day',now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'-(greatest(1,least(coalesce(p_days,30),365))-1)*interval '1 day';
  v_from_date date:=(v_from at time zone 'Europe/Warsaw')::date; v_org_ids uuid[]; v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select array_agg(distinct om.organization_id) into v_org_ids from public.organization_memberships om where om.user_id=v_actor and om.role in ('owner','admin','manager','viewer');
  if coalesce(array_length(v_org_ids,1),0)=0 then raise exception 'Analytics access required' using errcode='42501'; end if;
  select jsonb_build_object(
    'days',v_days,'from',v_from,'trackedFrom',(select min(e.occurred_at) from public.analytics_events e where e.organization_id=any(v_org_ids)),
    'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.organizations o where o.id=any(v_org_ids)),'[]'::jsonb),
    'finance',(select jsonb_build_object(
      'paidOrders',count(*) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),
      'gmv',coalesce(sum(o.total_amount) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),0),
      'averageOrderValue',coalesce(avg(o.total_amount) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),0),
      'currency',coalesce(min(o.currency) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),'PLN'),
      'ticketsSold',(select count(*) from public.tickets t join public.orders ot on ot.id=t.order_id where ot.organization_id=any(v_org_ids) and ot.confirmed_at>=v_from and ot.status::text='confirmed' and ot.payment_status::text='paid'),
      'refundedMinor',(select coalesce(sum(ms.refunded_amount_minor),0) from public.marketplace_settlements ms where ms.organization_id=any(v_org_ids) and ms.created_at>=v_from)
    ) from public.orders o where o.organization_id=any(v_org_ids) and coalesce(o.confirmed_at,o.created_at)>=v_from),
    'funnel',(select jsonb_build_object('impressions',coalesce(sum(impressions),0),'searchClicks',coalesce(sum(search_clicks),0),'views',coalesce(sum(views),0),'availabilityViews',coalesce(sum(availability_views),0),'sessionSelections',coalesce(sum(session_selections),0),'checkoutStarts',coalesce(sum(checkout_starts),0),'ordersCreated',coalesce(sum(orders_created),0),'paidOrders',coalesce(sum(paid_orders),0),'ticketsRedeemed',coalesce(sum(tickets_redeemed),0),'reviewsSubmitted',coalesce(sum(reviews_submitted),0)) from public.analytics_daily_attractions a where a.organization_id=any(v_org_ids) and a.day>=v_from_date),
    'capacity',(with scoped_sessions as (select s.id,s.capacity from public.sessions s join public.products pr on pr.id=s.product_id join public.venues v on v.id=pr.venue_id where v.organization_id=any(v_org_ids) and s.starts_at>=v_from and s.starts_at<now()+interval '1 day' and s.status::text='scheduled'), sold as (select oi.session_id,sum(oi.quantity*oi.capacity_units_each)::bigint sold_units from public.order_items oi join public.orders o on o.id=oi.order_id where o.organization_id=any(v_org_ids) and o.status::text='confirmed' and o.payment_status::text='paid' and oi.session_id in(select id from scoped_sessions) group by oi.session_id) select jsonb_build_object('capacity',coalesce(sum(ss.capacity),0),'soldUnits',coalesce(sum(coalesce(s.sold_units,0)),0),'fillRate',case when coalesce(sum(ss.capacity),0)>0 then round(100.0*sum(coalesce(s.sold_units,0))/sum(ss.capacity),1) else 0 end) from scoped_sessions ss left join sold s on s.session_id=ss.id),
    'topAttractions',coalesce((select jsonb_agg(row_to_json(q)) from (with tracked as (select a.attraction_id,sum(a.impressions)::bigint impressions,sum(a.views)::bigint views,sum(a.checkout_starts)::bigint checkout_starts,sum(a.paid_orders)::bigint tracked_paid_orders from public.analytics_daily_attractions a where a.organization_id=any(v_org_ids) and a.day>=v_from_date group by a.attraction_id), sales as (select pr.attraction_id,count(distinct o.id)::bigint paid_orders,coalesce(sum(oi.total_price_amount),0)::numeric gmv from public.orders o join public.order_items oi on oi.order_id=o.id join public.products pr on pr.id=oi.product_id where o.organization_id=any(v_org_ids) and o.status::text='confirmed' and o.payment_status::text='paid' and coalesce(o.confirmed_at,o.created_at)>=v_from and pr.attraction_id is not null group by pr.attraction_id) select coalesce(t.attraction_id,s.attraction_id) attraction_id,coalesce(p.title,'Atrakcja') title,coalesce(t.impressions,0) impressions,coalesce(t.views,0) views,coalesce(t.checkout_starts,0) checkout_starts,coalesce(s.paid_orders,0) paid_orders,coalesce(s.gmv,0) gmv from tracked t full join sales s on s.attraction_id=t.attraction_id left join public.properties p on p.id=coalesce(t.attraction_id,s.attraction_id) order by coalesce(s.gmv,0) desc,coalesce(t.views,0) desc limit 15) q),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.analytics_organizer_dashboard(integer) from public,anon;
grant execute on function public.analytics_organizer_dashboard(integer) to authenticated;
