-- Rolling compatibility for the currently deployed organizer verification form.
-- The legacy signature may submit the old three fields, but cannot make the
-- organization payment-ready because the new legal/contact/certification guard remains.

begin;

create or replace function public.organizer_submit_verification(
  p_organization_id uuid,
  p_legal_name text,
  p_tax_id text,
  p_billing_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_tax_id text := regexp_replace(coalesce(p_tax_id, ''), '[^0-9]', '', 'g');
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.organization_memberships membership
     where membership.organization_id = p_organization_id
       and membership.user_id = actor_user_id
       and membership.role in ('owner', 'admin')
  ) then
    raise exception 'Only an owner or administrator can submit verification'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_legal_name, ''))) < 2
     or normalized_tax_id !~ '^[0-9]{10}$'
     or char_length(btrim(coalesce(p_billing_email, ''))) < 3
     or position('@' in p_billing_email) <= 1 then
    raise exception 'Complete legacy verification fields are required' using errcode = '22023';
  end if;

  update public.organizations
     set legal_name = btrim(p_legal_name),
         tax_id = normalized_tax_id,
         billing_email = lower(btrim(p_billing_email)),
         verification_status = 'pending',
         verification_submitted_at = now(),
         verified_at = null,
         payments_enabled = false,
         trader_self_certified_at = null,
         updated_at = now()
   where id = p_organization_id;
end;
$$;

revoke all on function public.organizer_submit_verification(uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.organizer_submit_verification(uuid, text, text, text)
to authenticated, service_role;

commit;