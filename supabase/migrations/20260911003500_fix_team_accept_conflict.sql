-- Avoid PL/pgSQL OUT-parameter ambiguity in the invitation acceptance upsert.

begin;

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
    from public.organization_invitations invitation_row
   where invitation_row.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
   for update;

  if not found or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at <= now() then
    raise exception 'Invitation is invalid or expired' using errcode = 'P0002';
  end if;

  if lower(invitation.email) <> actor_email then
    raise exception 'Sign in with the email address that received the invitation' using errcode = '42501';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, invited_by)
  values (invitation.organization_id, actor_user_id, invitation.role, invitation.invited_by)
  on conflict on constraint organization_memberships_pkey do nothing;

  select membership.role into effective_role
    from public.organization_memberships membership
   where membership.organization_id = invitation.organization_id
     and membership.user_id = actor_user_id;

  update public.organization_invitations invitation_row
     set accepted_at = now(), updated_at = now()
   where invitation_row.id = invitation.id;

  return query
  select invitation.organization_id, organization.name, effective_role
    from public.organizations organization
   where organization.id = invitation.organization_id;
end;
$$;

commit;
