-- EnjoyHub marketplace messaging MVP
--
-- Scope:
--   customer <-> organizer text chat, tied to an order or attraction.
--   No attachments, reactions, editing, presence or typing indicators.
-- Security:
--   conversation creation and read markers go through SECURITY DEFINER RPCs;
--   message bodies are insert-only for authenticated participants.

begin;

create table if not exists public.marketplace_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete restrict,
  attraction_id uuid references public.properties(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  order_number bigint,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 160),
  organization_name text not null check (char_length(btrim(organization_name)) between 1 and 160),
  venue_name text not null check (char_length(btrim(venue_name)) between 1 and 160),
  attraction_title text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_conversations_customer_order_uidx
  on public.marketplace_conversations(customer_user_id, order_id)
  where order_id is not null;

create unique index if not exists marketplace_conversations_customer_attraction_uidx
  on public.marketplace_conversations(customer_user_id, attraction_id)
  where order_id is null and attraction_id is not null;

create index if not exists marketplace_conversations_customer_activity_idx
  on public.marketplace_conversations(customer_user_id, last_message_at desc);

create index if not exists marketplace_conversations_organization_activity_idx
  on public.marketplace_conversations(organization_id, last_message_at desc);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.marketplace_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_messages_conversation_created_idx
  on public.marketplace_messages(conversation_id, created_at, id);

create index if not exists marketplace_messages_unread_idx
  on public.marketplace_messages(conversation_id, created_at)
  where read_at is null;

create or replace function public.marketplace_can_access_conversation(
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.marketplace_conversations conversation
    where conversation.id = p_conversation_id
      and (
        conversation.customer_user_id = auth.uid()
        or public.ticketing_is_org_member(
          conversation.organization_id,
          array['owner', 'admin', 'manager']::public.ticketing_member_role[]
        )
      )
  );
$$;

revoke all on function public.marketplace_can_access_conversation(uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_can_access_conversation(uuid)
  to authenticated, service_role;

create or replace function public.marketplace_start_conversation(
  p_order_id uuid default null,
  p_attraction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  target_organization_id uuid;
  target_venue_id uuid;
  target_attraction_id uuid;
  target_order_number bigint;
  target_customer_name text;
  target_organization_name text;
  target_venue_name text;
  target_attraction_title text;
  existing_conversation_id uuid;
  created_conversation_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if (p_order_id is null and p_attraction_id is null)
     or (p_order_id is not null and p_attraction_id is not null) then
    raise exception 'Provide exactly one conversation context'
      using errcode = '22023';
  end if;

  select coalesce(
           nullif(btrim(profile.full_name), ''),
           nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
           nullif(split_part(auth_user.email::text, '@', 1), ''),
           'Użytkownik'
         )
    into target_customer_name
    from auth.users auth_user
    left join public.users profile on profile.id = auth_user.id
   where auth_user.id = actor_user_id;

  if p_order_id is not null then
    select
      customer_order.organization_id,
      customer_order.venue_id,
      customer_order.order_number,
      organization.name,
      venue.name,
      (
        select product.attraction_id
        from public.order_items item
        join public.products product on product.id = item.product_id
        where item.order_id = customer_order.id
        order by item.created_at, item.id
        limit 1
      )
      into
        target_organization_id,
        target_venue_id,
        target_order_number,
        target_organization_name,
        target_venue_name,
        target_attraction_id
      from public.orders customer_order
      join public.organizations organization on organization.id = customer_order.organization_id
      join public.venues venue on venue.id = customer_order.venue_id
      where customer_order.id = p_order_id
        and customer_order.customer_user_id = actor_user_id;

    if target_organization_id is null then
      raise exception 'Order is not available for this customer'
        using errcode = '42501';
    end if;

    if target_attraction_id is not null then
      select property.title
        into target_attraction_title
        from public.properties property
       where property.id = target_attraction_id;
    end if;

    select conversation.id
      into existing_conversation_id
      from public.marketplace_conversations conversation
     where conversation.customer_user_id = actor_user_id
       and conversation.order_id = p_order_id
     limit 1;
  else
    select
      venue.organization_id,
      property.venue_id,
      property.id,
      organization.name,
      venue.name,
      property.title
      into
        target_organization_id,
        target_venue_id,
        target_attraction_id,
        target_organization_name,
        target_venue_name,
        target_attraction_title
      from public.properties property
      join public.venues venue on venue.id = property.venue_id
      join public.organizations organization on organization.id = venue.organization_id
      where property.id = p_attraction_id
        and property.is_active = true
        and venue.status = 'active';

    if target_organization_id is null then
      raise exception 'Attraction is not available for messaging'
        using errcode = '22023';
    end if;

    select conversation.id
      into existing_conversation_id
      from public.marketplace_conversations conversation
     where conversation.customer_user_id = actor_user_id
       and conversation.order_id is null
       and conversation.attraction_id = p_attraction_id
     limit 1;
  end if;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.marketplace_conversations (
    customer_user_id,
    organization_id,
    venue_id,
    attraction_id,
    order_id,
    order_number,
    customer_name,
    organization_name,
    venue_name,
    attraction_title
  ) values (
    actor_user_id,
    target_organization_id,
    target_venue_id,
    target_attraction_id,
    p_order_id,
    target_order_number,
    target_customer_name,
    target_organization_name,
    target_venue_name,
    target_attraction_title
  )
  returning id into created_conversation_id;

  return created_conversation_id;
exception
  when unique_violation then
    if p_order_id is not null then
      select conversation.id
        into existing_conversation_id
        from public.marketplace_conversations conversation
       where conversation.customer_user_id = actor_user_id
         and conversation.order_id = p_order_id
       limit 1;
    else
      select conversation.id
        into existing_conversation_id
        from public.marketplace_conversations conversation
       where conversation.customer_user_id = actor_user_id
         and conversation.order_id is null
         and conversation.attraction_id = p_attraction_id
       limit 1;
    end if;
    return existing_conversation_id;
end;
$$;

revoke all on function public.marketplace_start_conversation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_start_conversation(uuid, uuid)
  to authenticated, service_role;

create or replace function public.marketplace_mark_conversation_read(
  p_conversation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  customer_user_id uuid;
  actor_is_customer boolean;
  updated_count integer;
begin
  if actor_user_id is null
     or not public.marketplace_can_access_conversation(p_conversation_id) then
    raise exception 'Conversation is not available'
      using errcode = '42501';
  end if;

  select conversation.customer_user_id
    into customer_user_id
    from public.marketplace_conversations conversation
   where conversation.id = p_conversation_id;

  actor_is_customer := actor_user_id = customer_user_id;

  update public.marketplace_messages message
     set read_at = now()
   where message.conversation_id = p_conversation_id
     and message.read_at is null
     and (
       (actor_is_customer and message.sender_user_id <> customer_user_id)
       or
       (not actor_is_customer and message.sender_user_id = customer_user_id)
     );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.marketplace_mark_conversation_read(uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_mark_conversation_read(uuid)
  to authenticated, service_role;

create or replace function public.marketplace_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.marketplace_conversations
     set last_message_at = new.created_at,
         updated_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.marketplace_touch_conversation() from public, anon, authenticated;

drop trigger if exists marketplace_messages_touch_conversation on public.marketplace_messages;
create trigger marketplace_messages_touch_conversation
after insert on public.marketplace_messages
for each row execute function public.marketplace_touch_conversation();

alter table public.marketplace_conversations enable row level security;
alter table public.marketplace_messages enable row level security;

drop policy if exists marketplace_conversations_select_participants on public.marketplace_conversations;
create policy marketplace_conversations_select_participants
on public.marketplace_conversations for select to authenticated
using (
  customer_user_id = auth.uid()
  or public.ticketing_is_org_member(
    organization_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
);

drop policy if exists marketplace_messages_select_participants on public.marketplace_messages;
create policy marketplace_messages_select_participants
on public.marketplace_messages for select to authenticated
using (public.marketplace_can_access_conversation(conversation_id));

drop policy if exists marketplace_messages_insert_participants on public.marketplace_messages;
create policy marketplace_messages_insert_participants
on public.marketplace_messages for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and public.marketplace_can_access_conversation(conversation_id)
);

revoke all on public.marketplace_conversations from public, anon, authenticated;
revoke all on public.marketplace_messages from public, anon, authenticated;

grant select on public.marketplace_conversations to authenticated;
grant select, insert on public.marketplace_messages to authenticated;

grant all on public.marketplace_conversations, public.marketplace_messages to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marketplace_messages'
  ) then
    alter publication supabase_realtime add table public.marketplace_messages;
  end if;
end
$$;

comment on table public.marketplace_conversations is
  'Minimal marketplace chat between one customer and an organizer organization, scoped to an order or attraction.';
comment on table public.marketplace_messages is
  'Insert-only text messages for marketplace conversations. Read markers are updated only through marketplace_mark_conversation_read.';

commit;
