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
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if staff_role is null then
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
    case when staff_role in ('platform_superadmin','platform_support','platform_finance') then
      (select count(*) from public.orders customer_order where customer_order.organization_id = org.id)
    else 0 end,
    case when staff_role in ('platform_superadmin','platform_finance') then
      coalesce((
        select sum(customer_order.total_amount)
        from public.orders customer_order
        where customer_order.organization_id = org.id
          and customer_order.status = 'confirmed'
          and customer_order.payment_status = 'paid'
      ), 0)::numeric
    else 0::numeric end
  from public.organizations org
  where p_search is null
     or btrim(p_search) = ''
     or org.name ilike '%' || btrim(p_search) || '%'
     or (staff_role in ('platform_superadmin','platform_finance') and coalesce(org.legal_name, '') ilike '%' || btrim(p_search) || '%')
     or (staff_role in ('platform_superadmin','platform_finance') and coalesce(org.tax_id, '') ilike '%' || btrim(p_search) || '%')
  order by org.created_at desc
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
  staff_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if staff_role is null then
    raise exception 'Platform staff access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'organization',
      jsonb_build_object(
        'id', org.id,
        'name', org.name,
        'status', org.status::text,
        'verification_status', org.verification_status::text,
        'payments_enabled', org.payments_enabled,
        'created_at', org.created_at,
        'updated_at', org.updated_at
      ) || case when staff_role in ('platform_superadmin','platform_finance') then
        jsonb_build_object(
          'legal_name', org.legal_name,
          'tax_id', org.tax_id,
          'billing_email', org.billing_email,
          'verification_submitted_at', org.verification_submitted_at,
          'verified_at', org.verified_at
        )
      else '{}'::jsonb end,
    'members', case when staff_role in ('platform_superadmin','platform_support') then coalesce((
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
    ), '[]'::jsonb) else '[]'::jsonb end,
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
      'orders', case when staff_role in ('platform_superadmin','platform_support','platform_finance') then (select count(*) from public.orders customer_order where customer_order.organization_id = org.id) else 0 end,
      'confirmedOrders', case when staff_role in ('platform_superadmin','platform_support','platform_finance') then (select count(*) from public.orders customer_order where customer_order.organization_id = org.id and customer_order.status = 'confirmed') else 0 end,
      'revenue', case when staff_role in ('platform_superadmin','platform_finance') then coalesce((select sum(customer_order.total_amount) from public.orders customer_order where customer_order.organization_id = org.id and customer_order.status = 'confirmed' and customer_order.payment_status = 'paid'), 0) else 0 end,
      'tickets', case when staff_role in ('platform_superadmin','platform_support') then (select count(*) from public.tickets ticket join public.orders customer_order on customer_order.id = ticket.order_id where customer_order.organization_id = org.id) else 0 end,
      'usedTickets', case when staff_role in ('platform_superadmin','platform_support') then (select count(*) from public.tickets ticket join public.orders customer_order on customer_order.id = ticket.order_id where customer_order.organization_id = org.id and ticket.status = 'used') else 0 end
    )
  ) into result
  from public.organizations org
  where org.id = p_organization_id;

  return result;
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

  select to_jsonb(org) into before_row from public.organizations org where org.id = p_organization_id for update;
  if before_row is null then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  if actor_role = 'platform_support' and (p_verification_status is not null or p_payments_enabled is not null) then
    raise exception 'Support cannot change verification or payment readiness' using errcode = '42501';
  end if;

  if actor_role = 'platform_finance' and (
    (p_name is not null and btrim(p_name) <> coalesce(before_row->>'name', ''))
    or (p_status is not null and p_status::text <> coalesce(before_row->>'status', ''))
  ) then
    raise exception 'Finance cannot change organization identity or status' using errcode = '42501';
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
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if staff_role not in ('platform_superadmin','platform_support','platform_finance') then
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
    case when staff_role = 'platform_support' then audit.before_data - array['legal_name','tax_id','billing_email'] else audit.before_data end,
    case when staff_role = 'platform_support' then audit.after_data - array['legal_name','tax_id','billing_email'] else audit.after_data end,
    audit.metadata,
    audit.created_at
  from public.platform_admin_audit_log audit
  join auth.users auth_user on auth_user.id = audit.actor_user_id
  where (p_organization_id is null or audit.organization_id = p_organization_id)
    and (staff_role <> 'platform_support' or audit.organization_id is not null)
  order by audit.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
end;
$$;
