do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_staff_role') then
    create type public.platform_staff_role as enum (
      'platform_superadmin',
      'platform_support',
      'platform_content',
      'platform_finance'
    );
  end if;
end $$;

create table if not exists public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_staff_role not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role public.platform_staff_role not null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_admin_audit_before_object check (jsonb_typeof(before_data) = 'object'),
  constraint platform_admin_audit_after_object check (jsonb_typeof(after_data) = 'object'),
  constraint platform_admin_audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists platform_admin_audit_org_created_idx
  on public.platform_admin_audit_log (organization_id, created_at desc);
create index if not exists platform_admin_audit_actor_created_idx
  on public.platform_admin_audit_log (actor_user_id, created_at desc);

create table if not exists public.platform_support_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_staff enable row level security;
alter table public.platform_admin_audit_log enable row level security;
alter table public.platform_support_context enable row level security;

create or replace function public.platform_is_staff(
  allowed_roles public.platform_staff_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_staff staff
    where staff.user_id = auth.uid()
      and staff.is_active
      and (allowed_roles is null or staff.role = any(allowed_roles))
  );
$$;

create or replace function public.platform_current_staff_role()
returns public.platform_staff_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select staff.role
  from public.platform_staff staff
  where staff.user_id = auth.uid()
    and staff.is_active
  limit 1;
$$;

revoke all on function public.platform_is_staff(public.platform_staff_role[]) from public;
revoke all on function public.platform_current_staff_role() from public;
grant execute on function public.platform_is_staff(public.platform_staff_role[]) to authenticated;
grant execute on function public.platform_current_staff_role() to authenticated;

revoke all on public.platform_staff from anon, authenticated;
revoke all on public.platform_admin_audit_log from anon, authenticated;
revoke all on public.platform_support_context from anon, authenticated;
grant select on public.platform_staff to authenticated;
grant select on public.platform_admin_audit_log to authenticated;
grant select on public.platform_support_context to authenticated;

drop policy if exists platform_staff_select_self_or_superadmin on public.platform_staff;
create policy platform_staff_select_self_or_superadmin
on public.platform_staff for select to authenticated
using (
  user_id = auth.uid()
  or public.platform_is_staff(array['platform_superadmin']::public.platform_staff_role[])
);

drop policy if exists platform_admin_audit_select_staff on public.platform_admin_audit_log;
create policy platform_admin_audit_select_staff
on public.platform_admin_audit_log for select to authenticated
using (
  public.platform_is_staff(array[
    'platform_superadmin',
    'platform_support',
    'platform_finance'
  ]::public.platform_staff_role[])
);

drop policy if exists platform_support_context_select_self on public.platform_support_context;
create policy platform_support_context_select_self
on public.platform_support_context for select to authenticated
using (user_id = auth.uid());

create or replace function public.platform_admin_list_organizations(
  p_search text default null,
  p_limit integer default 100
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_status text,
  verification_status text,
  payments_enabled boolean,
  created_at timestamptz,
  member_count bigint,
  venue_count bigint,
  attraction_count bigint,
  offer_count bigint,
  order_count bigint,
  confirmed_revenue numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.platform_is_staff(array[
    'platform_superadmin',
    'platform_support',
    'platform_content',
    'platform_finance'
  ]::public.platform_staff_role[]) then
    raise exception 'Platform staff access required' using errcode = '42501';
  end if;

  return query
  select
    org.id,
    org.name,
    org.status::text,
    org.verification_status::text,
    org.payments_enabled,
    org.created_at,
    (select count(*) from public.organization_memberships membership where membership.organization_id = org.id),
    (select count(*) from public.venues venue where venue.organization_id = org.id),
    (select count(*) from public.properties attraction join public.venues venue on venue.id = attraction.venue_id where venue.organization_id = org.id),
    (select count(*) from public.products product join public.venues venue on venue.id = product.venue_id where venue.organization_id = org.id),
    (select count(*) from public.orders customer_order where customer_order.organization_id = org.id),
    coalesce((
      select sum(customer_order.total_amount)
      from public.orders customer_order
      where customer_order.organization_id = org.id
        and customer_order.status = 'confirmed'
        and customer_order.payment_status = 'paid'
    ), 0)::numeric
  from public.organizations org
  where p_search is null
     or btrim(p_search) = ''
     or org.name ilike '%' || btrim(p_search) || '%'
     or coalesce(org.legal_name, '') ilike '%' || btrim(p_search) || '%'
     or coalesce(org.tax_id, '') ilike '%' || btrim(p_search) || '%'
  order by org.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
end;
$$;

create or replace function public.platform_admin_list_users(
  p_search text default null,
  p_limit integer default 100
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  organization_count bigint,
  platform_role text,
  memberships jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.platform_is_staff(array[
    'platform_superadmin',
    'platform_support'
  ]::public.platform_staff_role[]) then
    raise exception 'Platform support access required' using errcode = '42501';
  end if;

  return query
  select
    auth_user.id,
    auth_user.email::text,
    coalesce(profile.full_name, auth_user.raw_user_meta_data ->> 'full_name')::text,
    auth_user.created_at,
    (select count(*) from public.organization_memberships membership where membership.user_id = auth_user.id),
    staff.role::text,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'organizationId', org.id,
          'organizationName', org.name,
          'role', membership.role::text
        ) order by org.name
      )
      from public.organization_memberships membership
      join public.organizations org on org.id = membership.organization_id
      where membership.user_id = auth_user.id
    ), '[]'::jsonb)
  from auth.users auth_user
  left join public.users profile on profile.id = auth_user.id
  left join public.platform_staff staff on staff.user_id = auth_user.id and staff.is_active
  where p_search is null
     or btrim(p_search) = ''
     or auth_user.email ilike '%' || btrim(p_search) || '%'
     or coalesce(profile.full_name, '') ilike '%' || btrim(p_search) || '%'
  order by auth_user.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
end;
$$;

create or replace function public.platform_admin_get_organization(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.platform_is_staff(array[
    'platform_superadmin',
    'platform_support',
    'platform_content',
    'platform_finance'
  ]::public.platform_staff_role[]) then
    raise exception 'Platform staff access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'organization', to_jsonb(org),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', membership.user_id,
        'email', auth_user.email,
        'fullName', coalesce(profile.full_name, auth_user.raw_user_meta_data ->> 'full_name'),
        'role', membership.role::text,
        'createdAt', membership.created_at
      ) order by membership.created_at)
      from public.organization_memberships membership
      join auth.users auth_user on auth_user.id = membership.user_id
      left join public.users profile on profile.id = membership.user_id
      where membership.organization_id = org.id
    ), '[]'::jsonb),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', venue.id,
        'name', venue.name,
        'city', venue.city,
        'address', venue.address_line_1,
        'status', venue.status::text,
        'propertyId', venue.property_id,
        'createdAt', venue.created_at
      ) order by venue.created_at)
      from public.venues venue
      where venue.organization_id = org.id
    ), '[]'::jsonb),
    'attractions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', attraction.id,
        'venueId', attraction.venue_id,
        'title', attraction.title,
        'city', attraction.city,
        'address', attraction.address,
        'isActive', attraction.is_active,
        'createdAt', attraction.created_at
      ) order by attraction.created_at)
      from public.properties attraction
      join public.venues venue on venue.id = attraction.venue_id
      where venue.organization_id = org.id
    ), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id,
        'venueId', product.venue_id,
        'attractionId', product.attraction_id,
        'name', product.name,
        'status', product.status::text,
        'durationMinutes', product.duration_minutes,
        'createdAt', product.created_at
      ) order by product.created_at)
      from public.products product
      join public.venues venue on venue.id = product.venue_id
      where venue.organization_id = org.id
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'orders', (select count(*) from public.orders customer_order where customer_order.organization_id = org.id),
      'confirmedOrders', (select count(*) from public.orders customer_order where customer_order.organization_id = org.id and customer_order.status = 'confirmed'),
      'revenue', coalesce((select sum(customer_order.total_amount) from public.orders customer_order where customer_order.organization_id = org.id and customer_order.status = 'confirmed' and customer_order.payment_status = 'paid'), 0),
      'tickets', (select count(*) from public.tickets ticket join public.orders customer_order on customer_order.id = ticket.order_id where customer_order.organization_id = org.id),
      'usedTickets', (select count(*) from public.tickets ticket join public.orders customer_order on customer_order.id = ticket.order_id where customer_order.organization_id = org.id and ticket.status = 'used')
    )
  ) into result
  from public.organizations org
  where org.id = p_organization_id;

  return result;
end;
$$;

create or replace function public.platform_admin_create_organization(
  p_name text,
  p_owner_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  owner_id uuid;
  new_org_id uuid;
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support') then
    raise exception 'Platform support access required' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Organization name is required' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_owner_email, '')), '') is not null then
    select id into owner_id from auth.users where lower(email) = lower(btrim(p_owner_email)) limit 1;
    if owner_id is null then
      raise exception 'Owner email does not match an existing account' using errcode = 'P0002';
    end if;
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(p_name), coalesce(owner_id, actor_id))
  returning id into new_org_id;

  if owner_id is not null then
    insert into public.organization_memberships (organization_id, user_id, role, invited_by)
    values (new_org_id, owner_id, 'owner', actor_id)
    on conflict (organization_id, user_id) do update
      set role = excluded.role,
          invited_by = excluded.invited_by,
          updated_at = now();
  end if;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, new_org_id, 'organization.created', 'organization', new_org_id,
    jsonb_build_object('name', btrim(p_name), 'ownerUserId', owner_id, 'ownerEmail', nullif(btrim(coalesce(p_owner_email, '')), ''))
  );

  return new_org_id;
end;
$$;

create or replace function public.platform_admin_assign_member(
  p_organization_id uuid,
  p_user_email text,
  p_role public.ticketing_member_role
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  target_user_id uuid;
  previous_role public.ticketing_member_role;
  owner_count integer;
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support') then
    raise exception 'Platform support access required' using errcode = '42501';
  end if;

  if p_role = 'owner' and actor_role <> 'platform_superadmin' then
    raise exception 'Only platform superadmin can assign organization ownership' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  select id into target_user_id from auth.users where lower(email) = lower(btrim(p_user_email)) limit 1;
  if target_user_id is null then
    raise exception 'User email does not match an existing account' using errcode = 'P0002';
  end if;

  select role into previous_role
  from public.organization_memberships
  where organization_id = p_organization_id and user_id = target_user_id;

  if previous_role = 'owner' and p_role <> 'owner' then
    select count(*) into owner_count
    from public.organization_memberships
    where organization_id = p_organization_id and role = 'owner';
    if owner_count <= 1 then
      raise exception 'Cannot demote the last organization owner' using errcode = 'P0001';
    end if;
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, invited_by)
  values (p_organization_id, target_user_id, p_role, actor_id)
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        updated_at = now();

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id, actor_role, p_organization_id, 'membership.assigned', 'user', target_user_id,
    jsonb_build_object('role', previous_role),
    jsonb_build_object('role', p_role::text, 'email', lower(btrim(p_user_email)))
  );
end;
$$;

create or replace function public.platform_admin_update_organization(
  p_organization_id uuid,
  p_name text default null,
  p_status public.ticketing_organization_status default null,
  p_verification_status public.organizer_verification_status default null,
  p_payments_enabled boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  before_row jsonb;
  after_row jsonb;
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support', 'platform_finance') then
    raise exception 'Platform staff access required' using errcode = '42501';
  end if;

  if actor_role = 'platform_support' and (p_verification_status is not null or p_payments_enabled is not null) then
    raise exception 'Support cannot change verification or payment readiness' using errcode = '42501';
  end if;

  select to_jsonb(org) into before_row from public.organizations org where org.id = p_organization_id for update;
  if before_row is null then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  update public.organizations
  set name = coalesce(nullif(btrim(p_name), ''), name),
      status = coalesce(p_status, status),
      verification_status = coalesce(p_verification_status, verification_status),
      payments_enabled = coalesce(p_payments_enabled, payments_enabled),
      verified_at = case
        when p_verification_status = 'verified' then coalesce(verified_at, now())
        when p_verification_status is not null and p_verification_status <> 'verified' then null
        else verified_at
      end,
      updated_at = now()
  where id = p_organization_id;

  select to_jsonb(org) into after_row from public.organizations org where org.id = p_organization_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id, actor_role, p_organization_id, 'organization.updated', 'organization', p_organization_id, before_row, after_row
  );
end;
$$;

create or replace function public.platform_admin_create_venue(
  p_organization_id uuid,
  p_name text,
  p_address text default null,
  p_postal_code text default null,
  p_city text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  new_venue_id uuid;
  slug_base text;
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support', 'platform_content') then
    raise exception 'Platform content access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Venue name is required' using errcode = '22023';
  end if;

  slug_base := trim(both '-' from regexp_replace(lower(unaccent(btrim(p_name))), '[^a-z0-9]+', '-', 'g'));
  if slug_base = '' then slug_base := 'obiekt'; end if;

  insert into public.venues (
    organization_id, name, slug, address_line_1, postal_code, city, status, created_by
  ) values (
    p_organization_id,
    btrim(p_name),
    slug_base || '-' || substr(gen_random_uuid()::text, 1, 8),
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_postal_code, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    'draft',
    actor_id
  ) returning id into new_venue_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, p_organization_id, 'venue.created', 'venue', new_venue_id,
    jsonb_build_object('name', btrim(p_name), 'city', nullif(btrim(coalesce(p_city, '')), ''))
  );

  return new_venue_id;
end;
$$;

create or replace function public.platform_admin_create_attraction_draft(
  p_venue_id uuid,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  venue_row record;
  new_attraction_id uuid;
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support', 'platform_content') then
    raise exception 'Platform content access required' using errcode = '42501';
  end if;

  select venue.*, org.id as org_id
  into venue_row
  from public.venues venue
  join public.organizations org on org.id = venue.organization_id
  where venue.id = p_venue_id;

  if not found then
    raise exception 'Venue not found' using errcode = 'P0002';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'Attraction title is required' using errcode = '22023';
  end if;

  insert into public.properties (
    host_id, title, description, property_type, address, city, country,
    price_per_night, max_guests, images, is_active, venue_id
  ) values (
    null,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    'attraction',
    coalesce(venue_row.address_line_1, ''),
    coalesce(venue_row.city, ''),
    coalesce(venue_row.country_code, 'PL'),
    0,
    1,
    array[]::text[],
    false,
    p_venue_id
  ) returning id into new_attraction_id;

  update public.venues
  set property_id = coalesce(property_id, new_attraction_id),
      updated_at = now()
  where id = p_venue_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, venue_row.org_id, 'attraction.created', 'attraction', new_attraction_id,
    jsonb_build_object('title', btrim(p_title), 'venueId', p_venue_id)
  );

  return new_attraction_id;
end;
$$;

create or replace function public.platform_admin_set_support_context(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support') then
    raise exception 'Platform support access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  insert into public.platform_support_context (user_id, organization_id, activated_at, updated_at)
  values (actor_id, p_organization_id, now(), now())
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        activated_at = now(),
        updated_at = now();

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id
  ) values (
    actor_id, actor_role, p_organization_id, 'support_context.activated', 'organization', p_organization_id
  );
end;
$$;

create or replace function public.platform_admin_clear_support_context()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  previous_org uuid;
begin
  if actor_id is null or actor_role not in ('platform_superadmin', 'platform_support') then
    raise exception 'Platform support access required' using errcode = '42501';
  end if;

  select organization_id into previous_org from public.platform_support_context where user_id = actor_id;
  delete from public.platform_support_context where user_id = actor_id;

  if previous_org is not null then
    insert into public.platform_admin_audit_log (
      actor_user_id, actor_role, organization_id, action, entity_type, entity_id
    ) values (
      actor_id, actor_role, previous_org, 'support_context.cleared', 'organization', previous_org
    );
  end if;
end;
$$;

create or replace function public.platform_admin_list_audit(
  p_organization_id uuid default null,
  p_limit integer default 100
)
returns table (
  audit_id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  organization_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.platform_is_staff(array[
    'platform_superadmin',
    'platform_support',
    'platform_finance'
  ]::public.platform_staff_role[]) then
    raise exception 'Platform staff access required' using errcode = '42501';
  end if;

  return query
  select
    audit.id,
    audit.actor_user_id,
    auth_user.email::text,
    audit.actor_role::text,
    audit.organization_id,
    audit.action,
    audit.entity_type,
    audit.entity_id,
    audit.before_data,
    audit.after_data,
    audit.metadata,
    audit.created_at
  from public.platform_admin_audit_log audit
  join auth.users auth_user on auth_user.id = audit.actor_user_id
  where p_organization_id is null or audit.organization_id = p_organization_id
  order by audit.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
end;
$$;

revoke all on function public.platform_admin_list_organizations(text, integer) from public;
revoke all on function public.platform_admin_list_users(text, integer) from public;
revoke all on function public.platform_admin_get_organization(uuid) from public;
revoke all on function public.platform_admin_create_organization(text, text) from public;
revoke all on function public.platform_admin_assign_member(uuid, text, public.ticketing_member_role) from public;
revoke all on function public.platform_admin_update_organization(uuid, text, public.ticketing_organization_status, public.organizer_verification_status, boolean) from public;
revoke all on function public.platform_admin_create_venue(uuid, text, text, text, text) from public;
revoke all on function public.platform_admin_create_attraction_draft(uuid, text, text) from public;
revoke all on function public.platform_admin_set_support_context(uuid) from public;
revoke all on function public.platform_admin_clear_support_context() from public;
revoke all on function public.platform_admin_list_audit(uuid, integer) from public;

grant execute on function public.platform_admin_list_organizations(text, integer) to authenticated;
grant execute on function public.platform_admin_list_users(text, integer) to authenticated;
grant execute on function public.platform_admin_get_organization(uuid) to authenticated;
grant execute on function public.platform_admin_create_organization(text, text) to authenticated;
grant execute on function public.platform_admin_assign_member(uuid, text, public.ticketing_member_role) to authenticated;
grant execute on function public.platform_admin_update_organization(uuid, text, public.ticketing_organization_status, public.organizer_verification_status, boolean) to authenticated;
grant execute on function public.platform_admin_create_venue(uuid, text, text, text, text) to authenticated;
grant execute on function public.platform_admin_create_attraction_draft(uuid, text, text) to authenticated;
grant execute on function public.platform_admin_set_support_context(uuid) to authenticated;
grant execute on function public.platform_admin_clear_support_context() to authenticated;
grant execute on function public.platform_admin_list_audit(uuid, integer) to authenticated;
