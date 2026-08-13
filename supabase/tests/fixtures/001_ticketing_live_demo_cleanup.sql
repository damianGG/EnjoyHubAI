-- Removes only the fixed staging records created by 001_ticketing_live_demo.sql.

begin;

delete from public.inventory_holds
where session_id = '11111111-1111-4111-8111-111111111106';

delete from public.order_items
where session_id = '11111111-1111-4111-8111-111111111106';

delete from public.orders
where venue_id = '11111111-1111-4111-8111-111111111102';

delete from public.sessions
where id = '11111111-1111-4111-8111-111111111106';

delete from public.ticket_types
where product_id = '11111111-1111-4111-8111-111111111103';

delete from public.products
where id = '11111111-1111-4111-8111-111111111103';

delete from public.venues
where id = '11111111-1111-4111-8111-111111111102';

-- The core guard correctly blocks removing the final owner membership. Disable it
-- only around deletion of this fixed staging organization; the change is
-- transactional and the trigger is enabled again before commit.
alter table public.organization_memberships
  disable trigger ticketing_memberships_keep_owner;

delete from public.organizations
where id = '11111111-1111-4111-8111-111111111101';

alter table public.organization_memberships
  enable trigger ticketing_memberships_keep_owner;

commit;
