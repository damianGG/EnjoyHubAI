-- Trigger-only function: it must never be callable as a public/authenticated RPC.
revoke all on function public.marketplace_convert_demand_from_paid_order()
  from public, anon, authenticated;
