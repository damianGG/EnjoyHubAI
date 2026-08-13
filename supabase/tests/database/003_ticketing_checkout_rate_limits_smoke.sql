-- Run after the stage 1C migration. The transaction rolls back all test state.

begin;

do $ticketing_checkout_rate_limits_smoke$
declare
  test_key text := repeat('a', 64);
  first_attempt record;
  second_attempt record;
  blocked_attempt record;
begin
  if to_regclass('public.ticketing_checkout_rate_limits') is null then
    raise exception 'Missing ticketing checkout rate limit table';
  end if;

  if has_table_privilege(
    'anon',
    'public.ticketing_checkout_rate_limits',
    'SELECT'
  ) then
    raise exception 'anon must not read checkout rate limit state';
  end if;

  if has_function_privilege(
    'anon',
    'public.ticketing_consume_checkout_rate_limit(text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'anon must not consume checkout rate limits';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.ticketing_consume_checkout_rate_limit(text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not consume checkout rate limits';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.ticketing_consume_checkout_rate_limit(text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role must consume checkout rate limits';
  end if;

  select * into first_attempt
  from public.ticketing_consume_checkout_rate_limit(test_key, 2, 60);
  select * into second_attempt
  from public.ticketing_consume_checkout_rate_limit(test_key, 2, 60);
  select * into blocked_attempt
  from public.ticketing_consume_checkout_rate_limit(test_key, 2, 60);

  if not first_attempt.allowed
     or not second_attempt.allowed
     or blocked_attempt.allowed
     or blocked_attempt.retry_after_seconds < 1
     or blocked_attempt.attempts_used <> 3 then
    raise exception 'Checkout rate limit counter returned an invalid state';
  end if;
end
$ticketing_checkout_rate_limits_smoke$;

rollback;
