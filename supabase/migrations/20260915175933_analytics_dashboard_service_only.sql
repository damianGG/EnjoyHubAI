drop function if exists public.analytics_platform_dashboard(integer);
drop function if exists public.analytics_organizer_dashboard(integer);

create or replace function public.analytics_platform_dashboard_v1(p_actor_user_id uuid, p_days integer default 30)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_role public.platform_staff_role;
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_from timestamptz:=date_trunc('day',now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'-(greatest(1,least(coalesce(p_days,30),365))-1)*interval '1 day';
  v_from_date date:=(v_from at time zone 'Europe/Warsaw')::date;
  v_can_finance boolean; v_can_funnel boolean; v_can_search boolean; v_can_demand boolean; v_result jsonb;
begin
  select ps.role into v_role from public.platform_staff ps where ps.user_id=p_actor_user_id and ps.is_active=true;
  if p_actor_user_id is null or v_role is null then raise exception 'Platform staff access required' using errcode='42501'; end if;
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
revoke all on function public.analytics_platform_dashboard_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.analytics_platform_dashboard_v1(uuid,integer) to service_role;

create or replace function public.analytics_organizer_dashboard_v1(p_actor_user_id uuid,p_days integer default 30)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_from timestamptz:=date_trunc('day',now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'-(greatest(1,least(coalesce(p_days,30),365))-1)*interval '1 day';
  v_from_date date:=(v_from at time zone 'Europe/Warsaw')::date; v_org_ids uuid[]; v_result jsonb;
begin
  if p_actor_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select array_agg(distinct om.organization_id) into v_org_ids from public.organization_memberships om where om.user_id=p_actor_user_id and om.role in ('owner','admin','manager','viewer');
  if coalesce(array_length(v_org_ids,1),0)=0 then raise exception 'Analytics access required' using errcode='42501'; end if;
  select jsonb_build_object(
    'days',v_days,'from',v_from,'trackedFrom',(select min(e.occurred_at) from public.analytics_events e where e.organization_id=any(v_org_ids)),
    'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.organizations o where o.id=any(v_org_ids)),'[]'::jsonb),
    'finance',(select jsonb_build_object('paidOrders',count(*) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),'gmv',coalesce(sum(o.total_amount) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),0),'averageOrderValue',coalesce(avg(o.total_amount) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),0),'currency',coalesce(min(o.currency) filter(where o.status::text='confirmed' and o.payment_status::text='paid'),'PLN'),'ticketsSold',(select count(*) from public.tickets t join public.orders ot on ot.id=t.order_id where ot.organization_id=any(v_org_ids) and ot.confirmed_at>=v_from and ot.status::text='confirmed' and ot.payment_status::text='paid'),'refundedMinor',(select coalesce(sum(ms.refunded_amount_minor),0) from public.marketplace_settlements ms where ms.organization_id=any(v_org_ids) and ms.created_at>=v_from)) from public.orders o where o.organization_id=any(v_org_ids) and coalesce(o.confirmed_at,o.created_at)>=v_from),
    'funnel',(select jsonb_build_object('impressions',coalesce(sum(impressions),0),'searchClicks',coalesce(sum(search_clicks),0),'views',coalesce(sum(views),0),'availabilityViews',coalesce(sum(availability_views),0),'sessionSelections',coalesce(sum(session_selections),0),'checkoutStarts',coalesce(sum(checkout_starts),0),'ordersCreated',coalesce(sum(orders_created),0),'paidOrders',coalesce(sum(paid_orders),0),'ticketsRedeemed',coalesce(sum(tickets_redeemed),0),'reviewsSubmitted',coalesce(sum(reviews_submitted),0)) from public.analytics_daily_attractions a where a.organization_id=any(v_org_ids) and a.day>=v_from_date),
    'capacity',(with scoped_sessions as (select s.id,s.capacity from public.sessions s join public.products pr on pr.id=s.product_id join public.venues v on v.id=pr.venue_id where v.organization_id=any(v_org_ids) and s.starts_at>=v_from and s.starts_at<now()+interval '1 day' and s.status::text='scheduled'),sold as (select oi.session_id,sum(oi.quantity*oi.capacity_units_each)::bigint sold_units from public.order_items oi join public.orders o on o.id=oi.order_id where o.organization_id=any(v_org_ids) and o.status::text='confirmed' and o.payment_status::text='paid' and oi.session_id in(select id from scoped_sessions) group by oi.session_id) select jsonb_build_object('capacity',coalesce(sum(ss.capacity),0),'soldUnits',coalesce(sum(coalesce(s.sold_units,0)),0),'fillRate',case when coalesce(sum(ss.capacity),0)>0 then round(100.0*sum(coalesce(s.sold_units,0))/sum(ss.capacity),1) else 0 end) from scoped_sessions ss left join sold s on s.session_id=ss.id),
    'topAttractions',coalesce((select jsonb_agg(row_to_json(q)) from (with tracked as (select a.attraction_id,sum(a.impressions)::bigint impressions,sum(a.views)::bigint views,sum(a.checkout_starts)::bigint checkout_starts,sum(a.paid_orders)::bigint tracked_paid_orders from public.analytics_daily_attractions a where a.organization_id=any(v_org_ids) and a.day>=v_from_date group by a.attraction_id),sales as (select pr.attraction_id,count(distinct o.id)::bigint paid_orders,coalesce(sum(oi.total_price_amount),0)::numeric gmv from public.orders o join public.order_items oi on oi.order_id=o.id join public.products pr on pr.id=oi.product_id where o.organization_id=any(v_org_ids) and o.status::text='confirmed' and o.payment_status::text='paid' and coalesce(o.confirmed_at,o.created_at)>=v_from and pr.attraction_id is not null group by pr.attraction_id) select coalesce(t.attraction_id,s.attraction_id) attraction_id,coalesce(p.title,'Atrakcja') title,coalesce(t.impressions,0) impressions,coalesce(t.views,0) views,coalesce(t.checkout_starts,0) checkout_starts,coalesce(s.paid_orders,0) paid_orders,coalesce(s.gmv,0) gmv from tracked t full join sales s on s.attraction_id=t.attraction_id left join public.properties p on p.id=coalesce(t.attraction_id,s.attraction_id) order by coalesce(s.gmv,0) desc,coalesce(t.views,0) desc limit 15) q),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.analytics_organizer_dashboard_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.analytics_organizer_dashboard_v1(uuid,integer) to service_role;
