drop policy if exists "Super admin can manage categories" on public.categories;
create policy "Platform content staff can manage categories"
on public.categories for all to authenticated
using (public.platform_is_staff(array['platform_superadmin','platform_content']::public.platform_staff_role[]))
with check (public.platform_is_staff(array['platform_superadmin','platform_content']::public.platform_staff_role[]));

drop policy if exists "Super admin can manage subcategories" on public.subcategories;
create policy "Platform content staff can manage subcategories"
on public.subcategories for all to authenticated
using (public.platform_is_staff(array['platform_superadmin','platform_content']::public.platform_staff_role[]))
with check (public.platform_is_staff(array['platform_superadmin','platform_content']::public.platform_staff_role[]));

drop policy if exists "Super admins can manage category fields" on public.category_fields;
create policy "Platform content staff can manage category fields"
on public.category_fields for all to authenticated
using (public.platform_is_staff(array['platform_superadmin','platform_content']::public.platform_staff_role[]))
with check (public.platform_is_staff(array['platform_superadmin','platform_content']::public.platform_staff_role[]));

create or replace function public.platform_admin_audit_content_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  before_row jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  target_id uuid;
begin
  if actor_id is null or actor_role is null then
    return coalesce(new, old);
  end if;

  target_id := coalesce((after_row->>'id')::uuid, (before_row->>'id')::uuid);

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id,
    actor_role,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    target_id,
    before_row,
    after_row
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists platform_admin_audit_categories on public.categories;
create trigger platform_admin_audit_categories
after insert or update or delete on public.categories
for each row execute function public.platform_admin_audit_content_change();

drop trigger if exists platform_admin_audit_subcategories on public.subcategories;
create trigger platform_admin_audit_subcategories
after insert or update or delete on public.subcategories
for each row execute function public.platform_admin_audit_content_change();

drop trigger if exists platform_admin_audit_category_fields on public.category_fields;
create trigger platform_admin_audit_category_fields
after insert or update or delete on public.category_fields
for each row execute function public.platform_admin_audit_content_change();

create or replace function public.platform_admin_list_staff()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.platform_is_staff(array['platform_superadmin']::public.platform_staff_role[]) then
    raise exception 'Platform superadmin access required' using errcode = '42501';
  end if;

  return query
  select
    staff.user_id,
    auth_user.email::text,
    coalesce(profile.full_name, auth_user.raw_user_meta_data ->> 'full_name')::text,
    staff.role::text,
    staff.is_active,
    staff.created_at,
    staff.updated_at
  from public.platform_staff staff
  join auth.users auth_user on auth_user.id = staff.user_id
  left join public.users profile on profile.id = staff.user_id
  order by staff.is_active desc, staff.created_at asc;
end;
$$;

create or replace function public.platform_admin_upsert_staff(
  p_email text,
  p_role public.platform_staff_role,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  target_id uuid;
  previous_row jsonb := '{}'::jsonb;
  after_row jsonb;
  existing_role public.platform_staff_role;
  existing_active boolean;
  active_superadmins integer;
begin
  if actor_id is null or actor_role <> 'platform_superadmin' then
    raise exception 'Platform superadmin access required' using errcode = '42501';
  end if;

  select id into target_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_id is null then
    raise exception 'User email does not match an existing account' using errcode = 'P0002';
  end if;

  select staff.role, staff.is_active, to_jsonb(staff)
  into existing_role, existing_active, previous_row
  from public.platform_staff staff
  where staff.user_id = target_id;

  if target_id = actor_id and (p_role <> 'platform_superadmin' or not p_is_active) then
    raise exception 'You cannot remove your own superadmin access' using errcode = 'P0001';
  end if;

  if existing_role = 'platform_superadmin' and existing_active
     and (p_role <> 'platform_superadmin' or not p_is_active) then
    select count(*) into active_superadmins
    from public.platform_staff
    where role = 'platform_superadmin' and is_active;

    if active_superadmins <= 1 then
      raise exception 'At least one active platform superadmin is required' using errcode = 'P0001';
    end if;
  end if;

  insert into public.platform_staff (user_id, role, is_active, created_by)
  values (target_id, p_role, p_is_active, actor_id)
  on conflict (user_id) do update
    set role = excluded.role,
        is_active = excluded.is_active,
        updated_at = now();

  select to_jsonb(staff) into after_row
  from public.platform_staff staff
  where staff.user_id = target_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id,
    actor_role,
    'platform_staff.upserted',
    'platform_staff',
    target_id,
    coalesce(previous_row, '{}'::jsonb),
    after_row
  );

  return target_id;
end;
$$;

revoke all on function public.platform_admin_list_staff() from public;
revoke all on function public.platform_admin_upsert_staff(text, public.platform_staff_role, boolean) from public;
grant execute on function public.platform_admin_list_staff() to authenticated;
grant execute on function public.platform_admin_upsert_staff(text, public.platform_staff_role, boolean) to authenticated;
