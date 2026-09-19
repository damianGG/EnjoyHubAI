-- Run after 20260919183044_marketplace_messaging_mvp.sql.
-- Security and Realtime smoke checks for the marketplace messaging MVP.

begin;

do $marketplace_messaging_smoke$
declare
  start_function regprocedure;
  read_function regprocedure;
  access_function regprocedure;
  touch_function regprocedure;
begin
  if to_regclass('public.marketplace_conversations') is null
     or to_regclass('public.marketplace_messages') is null then
    raise exception 'Messaging tables are missing';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.marketplace_conversations'::regclass
  ) then
    raise exception 'marketplace_conversations must have RLS enabled';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.marketplace_messages'::regclass
  ) then
    raise exception 'marketplace_messages must have RLS enabled';
  end if;

  start_function := to_regprocedure('public.marketplace_start_conversation(uuid,uuid)');
  read_function := to_regprocedure('public.marketplace_mark_conversation_read(uuid)');
  access_function := to_regprocedure('public.marketplace_can_access_conversation(uuid)');
  touch_function := to_regprocedure('public.marketplace_touch_conversation()');

  if start_function is null
     or read_function is null
     or access_function is null
     or touch_function is null then
    raise exception 'One or more messaging functions are missing';
  end if;

  if has_function_privilege('anon', start_function, 'EXECUTE')
     or has_function_privilege('anon', read_function, 'EXECUTE')
     or has_function_privilege('anon', access_function, 'EXECUTE')
     or has_function_privilege('anon', touch_function, 'EXECUTE') then
    raise exception 'anon must not execute messaging functions';
  end if;

  if not has_function_privilege('authenticated', start_function, 'EXECUTE')
     or not has_function_privilege('authenticated', read_function, 'EXECUTE') then
    raise exception 'authenticated users need the public messaging RPCs';
  end if;

  if not has_function_privilege('authenticated', access_function, 'EXECUTE') then
    raise exception 'authenticated needs the RLS access helper';
  end if;

  if has_function_privilege('authenticated', touch_function, 'EXECUTE') then
    raise exception 'authenticated must not execute the trigger helper directly';
  end if;

  if not has_table_privilege('authenticated', 'public.marketplace_conversations', 'SELECT')
     or has_table_privilege('authenticated', 'public.marketplace_conversations', 'INSERT')
     or has_table_privilege('authenticated', 'public.marketplace_conversations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.marketplace_conversations', 'DELETE') then
    raise exception 'Conversation table grants are broader than intended';
  end if;

  if not has_table_privilege('authenticated', 'public.marketplace_messages', 'SELECT')
     or not has_table_privilege('authenticated', 'public.marketplace_messages', 'INSERT')
     or has_table_privilege('authenticated', 'public.marketplace_messages', 'UPDATE')
     or has_table_privilege('authenticated', 'public.marketplace_messages', 'DELETE') then
    raise exception 'Message table grants are broader than intended';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marketplace_messages'
  ) then
    raise exception 'marketplace_messages is not in the Supabase Realtime publication';
  end if;
end;
$marketplace_messaging_smoke$;

rollback;
