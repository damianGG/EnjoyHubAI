-- Supabase projects can grant broad default table privileges to API roles.
-- Normalize the canonical ticketing tables to the least-privilege model used
-- by the RLS policies and by the stage 1A smoke test.

begin;

revoke all privileges on table
  public.organizations,
  public.organization_memberships,
  public.venues,
  public.products,
  public.ticket_types,
  public.product_schedules,
  public.product_schedule_exceptions,
  public.sessions,
  public.orders,
  public.order_items,
  public.inventory_holds
from public, anon, authenticated;

revoke all privileges
on sequence public.orders_order_number_seq
from public, anon, authenticated;

grant select
on public.venues, public.products, public.ticket_types, public.sessions
to anon;

grant select, insert, update
on public.organizations
to authenticated;

grant select, insert, update, delete
on public.organization_memberships
to authenticated;

grant select, insert, update
on public.venues, public.products, public.ticket_types
to authenticated;

grant select, insert, update, delete
on
  public.product_schedules,
  public.product_schedule_exceptions,
  public.sessions
to authenticated;

grant select
on public.orders, public.order_items, public.inventory_holds
to authenticated;

grant all privileges on table
  public.organizations,
  public.organization_memberships,
  public.venues,
  public.products,
  public.ticket_types,
  public.product_schedules,
  public.product_schedule_exceptions,
  public.sessions,
  public.orders,
  public.order_items,
  public.inventory_holds
to service_role;

grant usage, select
on sequence public.orders_order_number_seq
to service_role;

commit;
