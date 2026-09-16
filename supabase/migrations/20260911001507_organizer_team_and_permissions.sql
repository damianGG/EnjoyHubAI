-- Organizer team management and role-safe invitations.
-- Point 10: owners/admins manage people through RPCs; direct membership writes
-- from authenticated clients are disabled so role invariants cannot be bypassed.

begin;

create extension if not exists pgcrypto;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.ticketing_member_role not null,
  token_hash text not null unique,
  invited_by uuid null references public.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_email_check check (
    char_length(btrim(email)) between 3 and 320
    and position('@' in email) > 1
  ),
  constraint organization_invitations_role_check check (role <> 'owner'::public.ticketing_member_role)
);

create unique index if not exists organization_invitations_active_email_uidx
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists organization_invitations_org_idx
  on public.organization_invitations (organization_id, created_at desc);
create index if not exists organization_invitations_expiry_idx
  on public.organization_invitations (expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.organization_invitations enable row level security;

revoke all on public.organization_invitations from public, anon, authenticated;
grant all on public.organization_invitations to service_role;

-- Keep membership reads for the app, but force every role mutation through the
-- security-definer RPCs below.
revoke insert, update, delete on public.organization_memberships from authenticated;
grant select on public.organization_memberships to authenticated;

create or replace function public.ticketing_team_actor_role(p_organization_id uuid)
returns public.ticketing_member_role
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select membership.role
    from public.organization_memberships membership
   where membership.organization_id = p_organization_id
     and membership.user_id = auth.uid()
   limit 1
$$;

revoke all on function public.ticketing_team_actor_role(uuid) from public, anon, authenticated;
grant execute on function public.ticketing_team_actor_role(uuid) to authenticated, service_role;

create or replace function public.ticketing_list_organization_team(p_organization_id uuid)
returns table (
  member_user_id uuid,
  full_name text,
  email text,
  role public.ticketing_member_role,
  joined_at timestamptz,
  is_current_user boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
declare
  actor_role public.ticketing_member_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  actor_role := public.ticketing_team_actor_role(p_organization_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and administrators can view the team' using errcode = '42501';
  end if;

  return query
  select
    membership.user_id,
    coalesce(nullif(btrim(profile.full_name), ''), nullif(auth_user.raw_user_meta_data->>'full_name', ''), split_part(auth_user.email, '@', 1)) as full_name,
    auth_user.email::text,
    membership.role,
    membership.created_at,
    membership.user_id = auth.uid()
  from public.organization_memberships membership
  join auth.users auth_user on auth_user.id = membership.user_id
  left join public.users profile on profile.id = membership.user_id
  where membership.organization_id = p_organization_id
  order by
    case membership.role
      when 'owner' then 1
      when 'admin' then 2
      when 'manager' then 3
      when 'cashier' then 4
      else 5
    end,
    membership.created_at;
end;
$$;

create or replace function public.ticketing_list_organization_invitations(p_organization_id uuid)
returns table (
  invitation_id uuid,
  email text,
  role public.ticketing_member_role,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  actor_role public.ticketing_member_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  actor_role := public.ticketing_team_actor_role(p_organization_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and administrators can view invitations' using errcode = '42501';
  end if;

  return query
  select invitation.id, invitation.email, invitation.role, invitation.expires_at, invitation.created_at
    from public.organization_invitations invitation
   where invitation.organization_id = p_organization_id
     and invitation.accepted_at is null
     and invitation.revoked_at is null
     and invitation.expires_at > now()
   order by invitation.created_at desc;
end;
$$;

create or replace function public.ticketing_create_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_role public.ticketing_member_role
)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role public.ticketing_member_role;
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  raw_token text;
  created_invitation public.organization_invitations%rowtype;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  actor_role := public.ticketing_team_actor_role(p_organization_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and administrators can invite team members' using errcode = '42501';
  end if;

  if normalized_email = '' or char_length(normalized_email) > 320 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;

  if p_role = 'owner' then
    raise exception 'Ownership is transferred from the member list, not by invitation' using errcode = '22023';
  end if;

  if actor_role = 'admin' and p_role = 'admin' then
    raise exception 'Only an owner can invite another administrator' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.organization_memberships membership
      join auth.users auth_user on auth_user.id = membership.user_id
     where membership.organization_id = p_organization_id
       and lower(auth_user.email) = normalized_email
  ) then
    raise exception 'This person already belongs to the organization' using errcode = '23505';
  end if;

  update public.organization_invitations
     set revoked_at = now(), updated_at = now()
   where organization_id = p_organization_id
     and lower(email) = normalized_email
     and accepted_at is null
     and revoked_at is null
     and expires_at <= now();

  if exists (
    select 1 from public.organization_invitations invitation
     where invitation.organization_id = p_organization_id
       and lower(invitation.email) = normalized_email
       and invitation.accepted_at is null
       and invitation.revoked_at is null
       and invitation.expires_at > now()
  ) then
    raise exception 'An active invitation already exists for this email' using errcode = '23505';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.organization_invitations (
    organization_id,
    email,
    role,
    token_hash,
    invited_by,
    expires_at
  ) values (
    p_organization_id,
    normalized_email,
    p_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    actor_user_id,
    now() + interval '7 days'
  )
  returning * into created_invitation;

  return query select created_invitation.id, raw_token, created_invitation.expires_at;
end;
$$;

create or replace function public.ticketing_get_organization_invitation(p_token text)
returns table (
  organization_id uuid,
  organization_name text,
  email text,
  role public.ticketing_member_role,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  actor_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  return query
  select invitation.organization_id, organization.name, invitation.email, invitation.role, invitation.expires_at
    from public.organization_invitations invitation
    join public.organizations organization on organization.id = invitation.organization_id
   where invitation.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and lower(invitation.email) = actor_email
     and invitation.accepted_at is null
     and invitation.revoked_at is null
     and invitation.expires_at > now()
   limit 1;
end;
$$;

create or replace function public.ticketing_accept_organization_invitation(p_token text)
returns table (
  organization_id uuid,
  organization_name text,
  accepted_role public.ticketing_member_role
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_email text := lower(coalesce(auth.jwt()->>'email', ''));
  invitation public.organization_invitations%rowtype;
  effective_role public.ticketing_member_role;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into invitation
    from public.organization_invitations
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
   for update;

  if not found or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at <= now() then
    raise exception 'Invitation is invalid or expired' using errcode = 'P0002';
  end if;

  if lower(invitation.email) <> actor_email then
    raise exception 'Sign in with the email address that received the invitation' using errcode = '42501';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, invited_by)
  values (invitation.organization_id, actor_user_id, invitation.role, invitation.invited_by)
  on conflict (organization_id, user_id) do nothing;

  select membership.role into effective_role
    from public.organization_memberships membership
   where membership.organization_id = invitation.organization_id
     and membership.user_id = actor_user_id;

  update public.organization_invitations
     set accepted_at = now(), updated_at = now()
   where id = invitation.id;

  return query
  select invitation.organization_id, organization.name, effective_role
    from public.organizations organization
   where organization.id = invitation.organization_id;
end;
$$;

create or replace function public.ticketing_update_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.ticketing_member_role
)
returns public.ticketing_member_role
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role public.ticketing_member_role;
  target_role public.ticketing_member_role;
  owner_count integer;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  actor_role := public.ticketing_team_actor_role(p_organization_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and administrators can change team roles' using errcode = '42501';
  end if;

  select membership.role into target_role
    from public.organization_memberships membership
   where membership.organization_id = p_organization_id
     and membership.user_id = p_user_id
   for update;

  if target_role is null then
    raise exception 'Team member was not found' using errcode = 'P0002';
  end if;

  if actor_role = 'admin' and (target_role in ('owner', 'admin') or p_role in ('owner', 'admin')) then
    raise exception 'Only an owner can manage owners or administrators' using errcode = '42501';
  end if;

  if p_role = 'owner' and actor_role <> 'owner' then
    raise exception 'Only an owner can grant ownership' using errcode = '42501';
  end if;

  if target_role = 'owner' and p_role <> 'owner' then
    select count(*) into owner_count
      from public.organization_memberships
     where organization_id = p_organization_id
       and role = 'owner';
    if owner_count <= 1 then
      raise exception 'The organization must always have at least one owner' using errcode = 'P0001';
    end if;
  end if;

  update public.organization_memberships
     set role = p_role, updated_at = now()
   where organization_id = p_organization_id
     and user_id = p_user_id;

  return p_role;
end;
$$;

create or replace function public.ticketing_remove_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role public.ticketing_member_role;
  target_role public.ticketing_member_role;
  owner_count integer;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  actor_role := public.ticketing_team_actor_role(p_organization_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and administrators can remove team members' using errcode = '42501';
  end if;

  select membership.role into target_role
    from public.organization_memberships membership
   where membership.organization_id = p_organization_id
     and membership.user_id = p_user_id
   for update;

  if target_role is null then
    raise exception 'Team member was not found' using errcode = 'P0002';
  end if;

  if actor_role = 'admin' and target_role in ('owner', 'admin') then
    raise exception 'Only an owner can remove owners or administrators' using errcode = '42501';
  end if;

  if target_role = 'owner' then
    select count(*) into owner_count
      from public.organization_memberships
     where organization_id = p_organization_id
       and role = 'owner';
    if owner_count <= 1 then
      raise exception 'The organization must always have at least one owner' using errcode = 'P0001';
    end if;
  end if;

  delete from public.organization_memberships
   where organization_id = p_organization_id
     and user_id = p_user_id;
end;
$$;

create or replace function public.ticketing_revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.organization_invitations%rowtype;
  actor_role public.ticketing_member_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into invitation
    from public.organization_invitations
   where id = p_invitation_id
     and accepted_at is null
     and revoked_at is null
   for update;

  if not found then
    raise exception 'Active invitation was not found' using errcode = 'P0002';
  end if;

  actor_role := public.ticketing_team_actor_role(invitation.organization_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and administrators can revoke invitations' using errcode = '42501';
  end if;

  if actor_role = 'admin' and invitation.role = 'admin' then
    raise exception 'Only an owner can revoke an administrator invitation' using errcode = '42501';
  end if;

  update public.organization_invitations
     set revoked_at = now(), updated_at = now()
   where id = p_invitation_id;
end;
$$;

revoke all on function public.ticketing_list_organization_team(uuid) from public, anon, authenticated;
revoke all on function public.ticketing_list_organization_invitations(uuid) from public, anon, authenticated;
revoke all on function public.ticketing_create_organization_invitation(uuid, text, public.ticketing_member_role) from public, anon, authenticated;
revoke all on function public.ticketing_get_organization_invitation(text) from public, anon, authenticated;
revoke all on function public.ticketing_accept_organization_invitation(text) from public, anon, authenticated;
revoke all on function public.ticketing_update_organization_member_role(uuid, uuid, public.ticketing_member_role) from public, anon, authenticated;
revoke all on function public.ticketing_remove_organization_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ticketing_revoke_organization_invitation(uuid) from public, anon, authenticated;

grant execute on function public.ticketing_list_organization_team(uuid) to authenticated, service_role;
grant execute on function public.ticketing_list_organization_invitations(uuid) to authenticated, service_role;
grant execute on function public.ticketing_create_organization_invitation(uuid, text, public.ticketing_member_role) to authenticated, service_role;
grant execute on function public.ticketing_get_organization_invitation(text) to authenticated, service_role;
grant execute on function public.ticketing_accept_organization_invitation(text) to authenticated, service_role;
grant execute on function public.ticketing_update_organization_member_role(uuid, uuid, public.ticketing_member_role) to authenticated, service_role;
grant execute on function public.ticketing_remove_organization_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.ticketing_revoke_organization_invitation(uuid) to authenticated, service_role;

comment on table public.organization_invitations is
  'Pending organization team invitations. Raw tokens are never stored; only SHA-256 hashes are persisted.';
comment on function public.ticketing_create_organization_invitation(uuid, text, public.ticketing_member_role) is
  'Creates a seven-day organization invitation and returns the one-time raw token to the authorized owner/admin.';
comment on function public.ticketing_accept_organization_invitation(text) is
  'Accepts an invitation only for the currently authenticated account whose email matches the invitation.';
comment on function public.ticketing_update_organization_member_role(uuid, uuid, public.ticketing_member_role) is
  'Changes organization roles while protecting owner/admin boundaries and the last-owner invariant.';

commit;
