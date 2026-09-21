-- Public read model: only active profiles, verified facts and active offers.
create or replace function public.marketplace_paintball_profile(p_property_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
 select jsonb_build_object(
   'facts', coalesce((select jsonb_object_agg(d.key, a.value)
     from public.supply_leads l
     join public.supply_attribute_values a on a.lead_id=l.id
     join public.supply_attribute_definitions d on d.id=a.definition_id
     where l.attraction_id=p.id and d.active
       and a.verification_status in ('verified','owner_confirmed')
       and d.key in ('field_count','field_area_m2','environment_type','terrain_forest','terrain_cqb','terrain_urban','terrain_bunkers','max_players_simultaneously','kids_paintball_available','low_impact_available','classic_paintball_available','field_exclusive_available','year_round','play_in_bad_weather','own_equipment_allowed','parking_available','toilet_available','covered_rest_area','grill_or_bonfire_available','catering_available','birthday_party','corporate_event','bachelor_party','school_groups')
   ), '{}'::jsonb),
   'packages', coalesce((select jsonb_agg(jsonb_build_object(
     'id', product.id, 'name',product.name,'description',product.description,
     'duration',product.duration_minutes,'minPlayers',product.min_participants,'maxPlayers',product.max_participants,
     'includes',product.includes,'arrival',product.arrival_instructions,
     'cancellation',product.cancellation_policy_text,
     'minAge',product.restrictions->'min_age','balls',product.restrictions->'balls_included',
     'unlimitedBalls',product.restrictions->'unlimited_balls','variant',product.restrictions->'paintball_variant',
     'pricingModel',product.restrictions->'pricing_model',
     'tickets',coalesce((select jsonb_agg(jsonb_build_object('name',t.name,'price',t.price_amount,'currency',t.currency) order by t.sort_order,t.name)
       from public.ticket_types t where t.product_id=product.id and t.is_active),'[]'::jsonb)
   ) order by product.name,product.id)
   from public.products product join public.venues v on v.id=product.venue_id
   where product.venue_id=p.venue_id and product.status='active' and v.status='active'), '[]'::jsonb)
 )
 from public.properties p
 left join public.categories c on c.id=p.category_id
 left join public.subcategories s on s.id=p.subcategory_id
 where p.id=p_property_id and p.is_active and (c.slug='paintball' or s.slug='paintball');
$$;
revoke all on function public.marketplace_paintball_profile(uuid) from public;
grant execute on function public.marketplace_paintball_profile(uuid) to anon, authenticated;
