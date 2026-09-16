create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.email_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  email_type text not null,
  to_addresses text[] not null check (cardinality(to_addresses) between 1 and 20),
  subject text not null,
  html_body text not null,
  text_body text not null,
  reply_to text,
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  dedupe_key text,
  provider text not null default 'resend',
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  failed_at timestamptz,
  resend_of_id uuid references public.email_outbox(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index email_outbox_dedupe_key_uidx on public.email_outbox(dedupe_key) where dedupe_key is not null;
create index email_outbox_delivery_idx on public.email_outbox(status, next_attempt_at, created_at) where status in ('pending','processing');
create index email_outbox_created_idx on public.email_outbox(created_at desc);
create index email_outbox_source_idx on public.email_outbox(source_type, source_id) where source_type is not null;

create table public.email_outbox_attempts (
  id bigint generated always as identity primary key,
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  attempt_no integer not null,
  result text not null check (result in ('sent','retry_scheduled','failed')),
  provider_message_id text,
  error text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  attempted_at timestamptz not null default now(),
  unique(outbox_id, attempt_no)
);
create index email_outbox_attempts_outbox_idx on public.email_outbox_attempts(outbox_id, attempted_at desc);

alter table public.email_outbox enable row level security;
alter table public.email_outbox_attempts enable row level security;
revoke all on table public.email_outbox from anon, authenticated;
revoke all on table public.email_outbox_attempts from anon, authenticated;
grant select, insert, update, delete on table public.email_outbox to service_role;
grant select, insert, update, delete on table public.email_outbox_attempts to service_role;
grant usage, select on sequence public.email_outbox_attempts_id_seq to service_role;

create or replace function public.email_outbox_enqueue(
  p_email_type text,
  p_to_addresses text[],
  p_subject text,
  p_html_body text,
  p_text_body text,
  p_reply_to text default null,
  p_tags jsonb default '[]'::jsonb,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_max_attempts integer default 5
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(coalesce(p_email_type,'')), '') is null then raise exception 'email_type is required'; end if;
  if p_to_addresses is null or cardinality(p_to_addresses) < 1 or cardinality(p_to_addresses) > 20 then raise exception 'to_addresses must contain 1..20 recipients'; end if;
  if nullif(btrim(coalesce(p_subject,'')), '') is null then raise exception 'subject is required'; end if;
  if p_tags is null or jsonb_typeof(p_tags) <> 'array' then raise exception 'tags must be a JSON array'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'metadata must be a JSON object'; end if;

  if nullif(btrim(coalesce(p_dedupe_key,'')), '') is not null then
    insert into public.email_outbox (
      email_type,to_addresses,subject,html_body,text_body,reply_to,tags,source_type,source_id,metadata,dedupe_key,max_attempts,next_attempt_at
    ) values (
      left(btrim(p_email_type),100), p_to_addresses, left(p_subject,998), p_html_body, p_text_body,
      nullif(btrim(coalesce(p_reply_to,'')),''), p_tags,
      nullif(btrim(coalesce(p_source_type,'')),''), nullif(btrim(coalesce(p_source_id,'')),''), p_metadata,
      left(btrim(p_dedupe_key),500), least(greatest(coalesce(p_max_attempts,5),1),10), now()
    )
    on conflict (dedupe_key) where dedupe_key is not null
    do update set dedupe_key = excluded.dedupe_key
    returning id into v_id;
  else
    insert into public.email_outbox (
      email_type,to_addresses,subject,html_body,text_body,reply_to,tags,source_type,source_id,metadata,max_attempts,next_attempt_at
    ) values (
      left(btrim(p_email_type),100), p_to_addresses, left(p_subject,998), p_html_body, p_text_body,
      nullif(btrim(coalesce(p_reply_to,'')),''), p_tags,
      nullif(btrim(coalesce(p_source_type,'')),''), nullif(btrim(coalesce(p_source_id,'')),''), p_metadata,
      least(greatest(coalesce(p_max_attempts,5),1),10), now()
    ) returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.email_outbox_claim_batch(
  p_limit integer default 25,
  p_outbox_id uuid default null
) returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_outbox
     set status='pending', locked_at=null, next_attempt_at=now(),
         last_error=coalesce(last_error, 'Recovered stale processing lease'), updated_at=now()
   where status='processing' and locked_at < now() - interval '10 minutes';

  return query
  with claimable as (
    select e.id
      from public.email_outbox e
     where e.status='pending'
       and e.attempt_count < e.max_attempts
       and (e.next_attempt_at is null or e.next_attempt_at <= now())
       and (p_outbox_id is null or e.id=p_outbox_id)
     order by e.next_attempt_at nulls first, e.created_at
     for update skip locked
     limit least(greatest(coalesce(p_limit,25),1),100)
  ), claimed as (
    update public.email_outbox e
       set status='processing', attempt_count=e.attempt_count+1, locked_at=now(), last_attempt_at=now(), updated_at=now()
      from claimable c
     where e.id=c.id
    returning e.*
  )
  select * from claimed;
end;
$$;

create or replace function public.email_outbox_complete(
  p_outbox_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null,
  p_duration_ms integer default null
) returns table(status text, next_attempt_at timestamptz, terminal boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.email_outbox%rowtype;
  v_terminal boolean;
  v_next timestamptz;
  v_result text;
begin
  select * into v_row from public.email_outbox where id=p_outbox_id for update;
  if not found then raise exception 'Outbox message not found' using errcode='P0002'; end if;

  if v_row.status <> 'processing' then
    return query select v_row.status, v_row.next_attempt_at, v_row.status in ('sent','failed');
    return;
  end if;

  if p_success then
    v_terminal := true;
    v_next := null;
    v_result := 'sent';
    update public.email_outbox
       set status='sent', provider_message_id=nullif(btrim(coalesce(p_provider_message_id,'')),''),
           sent_at=coalesce(sent_at,now()), failed_at=null, next_attempt_at=null,
           locked_at=null, last_error=null, updated_at=now()
     where id=p_outbox_id;
  else
    v_terminal := v_row.attempt_count >= v_row.max_attempts;
    v_next := case v_row.attempt_count
      when 1 then now() + interval '1 minute'
      when 2 then now() + interval '5 minutes'
      when 3 then now() + interval '15 minutes'
      when 4 then now() + interval '60 minutes'
      else now() + interval '4 hours'
    end;
    v_result := case when v_terminal then 'failed' else 'retry_scheduled' end;

    update public.email_outbox
       set status=case when v_terminal then 'failed' else 'pending' end,
           failed_at=case when v_terminal then now() else null end,
           next_attempt_at=case when v_terminal then null else v_next end,
           locked_at=null,
           last_error=left(coalesce(p_error,'Unknown email provider error'),4000),
           updated_at=now()
     where id=p_outbox_id;
  end if;

  insert into public.email_outbox_attempts(outbox_id,attempt_no,result,provider_message_id,error,duration_ms)
  values (p_outbox_id,v_row.attempt_count,v_result,
          nullif(btrim(coalesce(p_provider_message_id,'')),''),
          case when p_success then null else left(coalesce(p_error,'Unknown email provider error'),4000) end,
          case when p_duration_ms is null then null else greatest(p_duration_ms,0) end)
  on conflict (outbox_id,attempt_no) do nothing;

  return query
  select e.status,e.next_attempt_at,e.status in ('sent','failed')
  from public.email_outbox e where e.id=p_outbox_id;
end;
$$;

create or replace function public.email_outbox_admin_resend(p_actor_user_id uuid, p_outbox_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.email_outbox%rowtype;
  v_role text;
  v_new_id uuid;
begin
  select ps.role::text into v_role from public.platform_staff ps
   where ps.user_id=p_actor_user_id and ps.is_active=true;
  if v_role is null or v_role not in ('platform_superadmin','platform_support') then
    raise exception 'Not authorized to resend email' using errcode='42501';
  end if;

  select * into v_source from public.email_outbox where id=p_outbox_id;
  if not found then raise exception 'Outbox message not found' using errcode='P0002'; end if;

  insert into public.email_outbox(
    email_type,to_addresses,subject,html_body,text_body,reply_to,tags,source_type,source_id,metadata,
    provider,max_attempts,next_attempt_at,resend_of_id
  ) values (
    v_source.email_type,v_source.to_addresses,v_source.subject,v_source.html_body,v_source.text_body,v_source.reply_to,v_source.tags,
    v_source.source_type,v_source.source_id,
    v_source.metadata || jsonb_build_object('manual_resend',true,'resend_requested_by',p_actor_user_id,'resend_of',v_source.id),
    v_source.provider,v_source.max_attempts,now(),v_source.id
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.email_outbox_verify_worker_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name='email_outbox_worker_token'
  order by created_at desc
  limit 1;
  return p_token is not null and length(p_token) >= 32 and v_secret is not null and p_token=v_secret;
end;
$$;

revoke all on function public.email_outbox_enqueue(text,text[],text,text,text,text,jsonb,text,text,jsonb,text,integer) from public, anon, authenticated;
revoke all on function public.email_outbox_claim_batch(integer,uuid) from public, anon, authenticated;
revoke all on function public.email_outbox_complete(uuid,boolean,text,text,integer) from public, anon, authenticated;
revoke all on function public.email_outbox_admin_resend(uuid,uuid) from public, anon, authenticated;
revoke all on function public.email_outbox_verify_worker_token(text) from public, anon, authenticated;
grant execute on function public.email_outbox_enqueue(text,text[],text,text,text,text,jsonb,text,text,jsonb,text,integer) to service_role;
grant execute on function public.email_outbox_claim_batch(integer,uuid) to service_role;
grant execute on function public.email_outbox_complete(uuid,boolean,text,text,integer) to service_role;
grant execute on function public.email_outbox_admin_resend(uuid,uuid) to service_role;
grant execute on function public.email_outbox_verify_worker_token(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name='email_outbox_worker_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'email_outbox_worker_token','EnjoyHub email outbox worker token');
  end if;
end $$;

select cron.schedule(
  'email-outbox-worker-v1',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://www.enjoyhub.app/api/email/outbox/process',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-enjoyhub-email-token',(select decrypted_secret from vault.decrypted_secrets where name='email_outbox_worker_token' order by created_at desc limit 1)
      ),
      body := '{"source":"supabase-cron"}'::jsonb,
      timeout_milliseconds := 15000
    );
  $cron$
);
