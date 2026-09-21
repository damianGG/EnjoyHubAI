begin;
do $$
declare
 actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; org uuid; venue uuid; product uuid; c uuid; p uuid; lead uuid; definition uuid; result jsonb;
begin
 insert into public.categories(name,slug,icon) values ('Paintball','paintball','target') on conflict(slug) do update set name=excluded.name returning id into c;
 insert into public.properties(title,property_type,address,city,country,price_per_night,category_id,is_active)
 values ('Paintball test','attraction','Test 1','Test','PL',0,c,true) returning id into p;
 insert into public.supply_leads(name,city,status,category_id,attraction_id,admin_notes)
 values ('Paintball test','Test','published',c,p,'PRIVATE NOTE') returning id into lead;
 insert into public.supply_attribute_definitions(category_id,key,label,value_type)
 values (c,'field_count','Liczba pól','number') on conflict(category_id,key) where category_id is not null and subcategory_id is null do update set active=true returning id into definition;
 insert into public.supply_attribute_values(lead_id,definition_id,value,verification_status) values(lead,definition,'3','suggested');
 result:=public.marketplace_paintball_profile(p);
 if result->'facts' <> '{}'::jsonb then raise exception 'AI suggestion exposed'; end if;
 update public.supply_attribute_values set verification_status='verified' where lead_id=lead;
 result:=public.marketplace_paintball_profile(p);
 if result->'facts'->'field_count' <> '3'::jsonb then raise exception 'Verified fact missing'; end if;
 if result::text like '%PRIVATE NOTE%' then raise exception 'Private note exposed'; end if;
 insert into public.organizations(name,created_by) values('Paintball test',actor) returning id into org;
 insert into public.venues(organization_id,name,slug,created_by,status,property_id) values(org,'Paintball test','paintball-test',actor,'active',p) returning id into venue;
 update public.properties set venue_id=venue where id=p;
 insert into public.products(venue_id,name,slug,duration_minutes,created_by,status,restrictions,includes)
 values(venue,'Pakiet test','pakiet-test',90,actor,'active','{"min_age":16,"balls_included":500,"private_key":"SECRET"}',array['Maska']) returning id into product;
 insert into public.ticket_types(product_id,name,price_amount,currency) values(product,'Uczestnik',120,'PLN');
 result:=public.marketplace_paintball_profile(p);
 if jsonb_array_length(result->'packages')<>1 or result->'packages'->0->'minAge'<>'16'::jsonb or result->'packages'->0->'tickets'->0->'price'<>'120'::jsonb then raise exception 'Published package missing or incorrect'; end if;
 if result::text like '%SECRET%' then raise exception 'Unlisted product metadata exposed'; end if;
 update public.products set status='draft' where id=product;
 if public.marketplace_paintball_profile(p)->'packages'<>'[]'::jsonb then raise exception 'Draft package exposed'; end if;
 update public.properties set is_active=false where id=p;
 if public.marketplace_paintball_profile(p) is not null then raise exception 'Inactive profile exposed'; end if;
 if not has_function_privilege('anon','public.marketplace_paintball_profile(uuid)','execute') then raise exception 'Map visitors cannot load profile'; end if;
end;
$$;
rollback;
