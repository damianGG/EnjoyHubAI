-- Qualify invitation columns that collide with OUT parameter names in PL/pgSQL.

begin;

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

  update public.organization_invitations invitation
     set revoked_at = now(), updated_at = now()
   where invitation.organization_id = p_organization_id
     and lower(invitation.email) = normalized_email
     and invitation.accepted_at is null
     and invitation.revoked_at is null
     and invitation.expires_at <= now();

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

commit;
