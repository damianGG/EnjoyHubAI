-- Demand capture is submitted through a Next.js server action using the server-only
-- Supabase service role. Keep the underlying table and write RPC unavailable to
-- public clients so customer e-mail addresses are never exposed through Data API.
revoke all on function public.marketplace_register_attraction_interest(uuid,text,date,integer) from public, anon, authenticated;
grant execute on function public.marketplace_register_attraction_interest(uuid,text,date,integer) to service_role;
