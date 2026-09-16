create index if not exists attraction_demand_notifications_attraction_idx
  on public.attraction_demand_notifications (attraction_id);

create index if not exists attraction_demand_notifications_organization_idx
  on public.attraction_demand_notifications (organization_id);
