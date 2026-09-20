begin;

do $$
declare
  actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  lead_id uuid;
  published jsonb;
  again jsonb;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.platform_staff(user_id, role) values (actor, 'platform_content')
    on conflict (user_id) do update set role = 'platform_content', is_active = true;
  insert into public.supply_leads(name, city, status, latitude, longitude)
    values ('Supply publication test', 'Rzeszów', 'discovered', 50.041, 21.999)
    returning id into lead_id;

  begin
    perform public.platform_supply_publish_lead(lead_id);
    raise exception 'Unverified lead was published' using errcode = 'XX000';
  exception when sqlstate 'P0001' then null;
  end;
  update public.supply_leads set status = 'verified', city = ' ' where id = lead_id;
  begin
    perform public.platform_supply_publish_lead(lead_id);
    raise exception 'Lead without city was published' using errcode = 'XX000';
  exception when sqlstate '22023' then null;
  end;
  update public.supply_leads set city = 'Rzeszów' where id = lead_id;
  insert into public.supply_lead_images(lead_id, image_url, rights_confirmed, is_primary)
    values (lead_id, 'https://example.com/allowed.jpg', true, true),
           (lead_id, 'https://example.com/draft.jpg', false, false);

  published := public.platform_supply_publish_lead(lead_id);
  if not exists (
    select 1 from public.supply_leads l
    join public.properties p on p.id = l.attraction_id
    where l.id = lead_id and l.status = 'published'
      and l.venue_id = (published->>'venueId')::uuid
      and p.latitude = 50.041 and p.longitude = 21.999
      and p.images = array['https://example.com/allowed.jpg']::text[]
      and p.host_id is null and p.is_active
  ) then
    raise exception 'Published profile lost links, coordinates or image rights filtering';
  end if;
  again := public.platform_supply_publish_lead(lead_id);
  if again <> published then raise exception 'Repeated publication created a duplicate'; end if;

  delete from public.platform_staff where user_id = actor;
  begin
    perform public.platform_supply_publish_lead(lead_id);
    raise exception 'Non-staff user published a profile' using errcode = 'XX000';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;
