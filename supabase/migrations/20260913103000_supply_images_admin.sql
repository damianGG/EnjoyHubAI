create or replace function public.platform_supply_sync_attraction_images(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
  target_attraction_id uuid;
  image_urls text[];
begin
  if staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select attraction_id into target_attraction_id
  from public.supply_leads
  where id = p_lead_id;

  if target_attraction_id is null then
    return;
  end if;

  select coalesce(array_agg(image_url order by is_primary desc, sort_order, created_at), array[]::text[])
  into image_urls
  from public.supply_lead_images
  where lead_id = p_lead_id and rights_confirmed = true;

  update public.properties
  set images = image_urls, updated_at = now()
  where id = target_attraction_id;
end;
$$;

create or replace function public.platform_supply_add_image(
  p_lead_id uuid,
  p_image_url text,
  p_cloudinary_public_id text default null,
  p_source_type text default 'admin',
  p_source_url text default null,
  p_rights_confirmed boolean default false,
  p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  image_id uuid;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.supply_leads where id = p_lead_id) then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  if nullif(btrim(coalesce(p_image_url, '')), '') is null then
    raise exception 'Image URL is required' using errcode = '22023';
  end if;

  if p_source_type not in ('admin','owner','licensed','public_reference') then
    raise exception 'Invalid image source type' using errcode = '22023';
  end if;

  if p_is_primary then
    update public.supply_lead_images set is_primary = false where lead_id = p_lead_id;
  end if;

  insert into public.supply_lead_images (
    lead_id, image_url, cloudinary_public_id, source_type, source_url,
    rights_confirmed, is_primary, sort_order, created_by
  ) values (
    p_lead_id, btrim(p_image_url), nullif(btrim(coalesce(p_cloudinary_public_id, '')), ''),
    p_source_type, nullif(btrim(coalesce(p_source_url, '')), ''),
    p_rights_confirmed, p_is_primary,
    coalesce((select max(sort_order) + 1 from public.supply_lead_images where lead_id = p_lead_id), 0),
    actor_id
  ) returning id into image_id;

  perform public.platform_supply_sync_attraction_images(p_lead_id);

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, 'supply.image.added', 'supply_lead_image', image_id,
    jsonb_build_object('leadId', p_lead_id, 'sourceType', p_source_type, 'rightsConfirmed', p_rights_confirmed)
  );

  return image_id;
end;
$$;

create or replace function public.platform_supply_remove_image(p_image_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  image_row public.supply_lead_images%rowtype;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into image_row from public.supply_lead_images where id = p_image_id for update;
  if not found then
    raise exception 'Supply image not found' using errcode = 'P0002';
  end if;

  delete from public.supply_lead_images where id = p_image_id;
  perform public.platform_supply_sync_attraction_images(image_row.lead_id);

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, before_data
  ) values (
    actor_id, actor_role, 'supply.image.removed', 'supply_lead_image', p_image_id, to_jsonb(image_row)
  );

  return image_row.cloudinary_public_id;
end;
$$;

revoke all on function public.platform_supply_sync_attraction_images(uuid) from public, anon;
revoke all on function public.platform_supply_add_image(uuid,text,text,text,text,boolean,boolean) from public, anon;
revoke all on function public.platform_supply_remove_image(uuid) from public, anon;

grant execute on function public.platform_supply_sync_attraction_images(uuid) to authenticated;
grant execute on function public.platform_supply_add_image(uuid,text,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.platform_supply_remove_image(uuid) to authenticated;
