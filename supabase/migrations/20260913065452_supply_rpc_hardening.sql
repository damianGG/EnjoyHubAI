-- Harden Supply RPCs so they are never callable by anonymous visitors.
-- Authenticated users may reach the RPC boundary, but each function also checks
-- the canonical platform_staff role and rejects non-Supply staff with 42501.

revoke execute on function public.platform_supply_list_leads(text,text,text,integer) from anon;
revoke execute on function public.platform_supply_get_lead(uuid) from anon;
revoke execute on function public.platform_supply_create_lead(jsonb) from anon;
revoke execute on function public.platform_supply_update_lead(uuid,jsonb) from anon;

revoke execute on function public.platform_supply_list_leads(text,text,text,integer) from public;
revoke execute on function public.platform_supply_get_lead(uuid) from public;
revoke execute on function public.platform_supply_create_lead(jsonb) from public;
revoke execute on function public.platform_supply_update_lead(uuid,jsonb) from public;

grant execute on function public.platform_supply_list_leads(text,text,text,integer) to authenticated;
grant execute on function public.platform_supply_get_lead(uuid) to authenticated;
grant execute on function public.platform_supply_create_lead(jsonb) to authenticated;
grant execute on function public.platform_supply_update_lead(uuid,jsonb) to authenticated;
