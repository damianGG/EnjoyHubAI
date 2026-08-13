-- EnjoyHubAI ticketing core - stage 1C
-- Durable, privacy-preserving rate limits for the public checkout endpoint.

begin;

create table public.ticketing_checkout_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (expires_at > window_started_at)
);

create index ticketing_checkout_rate_limits_expires_at_idx
  on public.ticketing_checkout_rate_limits(expires_at);

alter table public.ticketing_checkout_rate_limits enable row level security;

revoke all privileges on table public.ticketing_checkout_rate_limits
from public, anon, authenticated;

grant all privileges on table public.ticketing_checkout_rate_limits
to service_role;

create or replace function public.ticketing_consume_checkout_rate_limit(
  p_key_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  attempts_used integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  rate_state record;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Rate limit key must be a lowercase SHA-256 hash'
      using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Rate limit must be between 1 and 1000'
      using errcode = '22023';
  end if;

  if p_window_seconds is null
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception 'Rate limit window must be between 1 and 86400 seconds'
      using errcode = '22023';
  end if;

  insert into public.ticketing_checkout_rate_limits (
    key_hash,
    window_started_at,
    attempt_count,
    expires_at,
    updated_at
  ) values (
    p_key_hash,
    v_now,
    1,
    v_now + make_interval(secs => p_window_seconds),
    v_now
  )
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.ticketing_checkout_rate_limits.expires_at <= v_now
        then v_now
      else public.ticketing_checkout_rate_limits.window_started_at
    end,
    attempt_count = case
      when public.ticketing_checkout_rate_limits.expires_at <= v_now
        then 1
      else public.ticketing_checkout_rate_limits.attempt_count + 1
    end,
    expires_at = case
      when public.ticketing_checkout_rate_limits.expires_at <= v_now
        then v_now + make_interval(secs => p_window_seconds)
      else public.ticketing_checkout_rate_limits.expires_at
    end,
    updated_at = v_now
  returning
    attempt_count,
    expires_at
  into rate_state;

  return query select
    rate_state.attempt_count <= p_limit,
    case
      when rate_state.attempt_count <= p_limit then 0
      else greatest(
        ceil(extract(epoch from rate_state.expires_at - v_now))::integer,
        1
      )
    end,
    rate_state.attempt_count;
end;
$$;

revoke all on function public.ticketing_consume_checkout_rate_limit(
  text, integer, integer
) from public, anon, authenticated;

grant execute on function public.ticketing_consume_checkout_rate_limit(
  text, integer, integer
) to service_role;

comment on table public.ticketing_checkout_rate_limits is
  'Short-lived HMAC fingerprints used to protect public checkout from mass inventory holds.';

commit;
