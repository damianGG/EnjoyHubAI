-- Convert the existing activity-as-category data into the canonical two-level catalog.
-- Existing legacy category rows are retained for category_fields/object_field_values compatibility.

do $$
declare
  old_paintball uuid;
  old_gokarty uuid;
  old_dmuchance uuid;
  old_mini_golf uuid;
  old_escape_room uuid;

  adrenalina uuid;
  dzieci_rodzina uuid;
  zagadki_gry uuid;

  paintball uuid;
  gokarty uuid;
  dmuchance uuid;
  mini_golf uuid;
  escape_room uuid;
begin
  select id into old_paintball from public.categories where slug = 'paintball';
  select id into old_gokarty from public.categories where slug = 'go-karts';
  select id into old_dmuchance from public.categories where slug = 'dmuchance';
  select id into old_mini_golf from public.categories where slug = 'mini-golf';
  select id into old_escape_room from public.categories where slug = 'escape-room';

  insert into public.categories (name, slug, icon, description, catalog_visible)
  values
    ('Adrenalina', 'adrenalina', '⚡', 'Dynamiczne atrakcje, rywalizacja i mocne emocje.', true),
    ('Dzieci i rodzina', 'dzieci-i-rodzina', '🧸', 'Atrakcje dla dzieci i wspólnego rodzinnego czasu.', true),
    ('Zagadki i gry', 'zagadki-i-gry', '🧩', 'Gry, zagadki i aktywności wymagające sprytu.', true)
  on conflict (slug) do update
    set name = excluded.name,
        icon = excluded.icon,
        description = excluded.description,
        catalog_visible = true;

  select id into adrenalina from public.categories where slug = 'adrenalina';
  select id into dzieci_rodzina from public.categories where slug = 'dzieci-i-rodzina';
  select id into zagadki_gry from public.categories where slug = 'zagadki-i-gry';

  if adrenalina is null or dzieci_rodzina is null or zagadki_gry is null then
    raise exception 'Unable to create canonical category wrappers';
  end if;

  if old_paintball is not null then
    insert into public.subcategories (
      parent_category_id, name, slug, icon, description, image_url, image_public_id
    )
    select adrenalina, 'Paintball', 'paintball', icon, description, image_url, image_public_id
    from public.categories where id = old_paintball
    on conflict (parent_category_id, slug) do update
      set name = excluded.name,
          icon = excluded.icon,
          description = excluded.description,
          image_url = excluded.image_url,
          image_public_id = excluded.image_public_id;
    select id into paintball from public.subcategories where parent_category_id = adrenalina and slug = 'paintball';
  end if;

  if old_gokarty is not null then
    insert into public.subcategories (
      parent_category_id, name, slug, icon, description, image_url, image_public_id
    )
    select adrenalina, 'Gokarty', 'go-karts', icon, description, image_url, image_public_id
    from public.categories where id = old_gokarty
    on conflict (parent_category_id, slug) do update
      set name = excluded.name,
          icon = excluded.icon,
          description = excluded.description,
          image_url = excluded.image_url,
          image_public_id = excluded.image_public_id;
    select id into gokarty from public.subcategories where parent_category_id = adrenalina and slug = 'go-karts';
  end if;

  if old_dmuchance is not null then
    insert into public.subcategories (
      parent_category_id, name, slug, icon, description, image_url, image_public_id
    )
    select dzieci_rodzina, 'Dmuchańce', 'dmuchance', icon, description, image_url, image_public_id
    from public.categories where id = old_dmuchance
    on conflict (parent_category_id, slug) do update
      set name = excluded.name,
          icon = excluded.icon,
          description = excluded.description,
          image_url = excluded.image_url,
          image_public_id = excluded.image_public_id;
    select id into dmuchance from public.subcategories where parent_category_id = dzieci_rodzina and slug = 'dmuchance';
  end if;

  if old_mini_golf is not null then
    insert into public.subcategories (
      parent_category_id, name, slug, icon, description, image_url, image_public_id
    )
    select zagadki_gry, 'Mini Golf', 'mini-golf', icon, description, image_url, image_public_id
    from public.categories where id = old_mini_golf
    on conflict (parent_category_id, slug) do update
      set name = excluded.name,
          icon = excluded.icon,
          description = excluded.description,
          image_url = excluded.image_url,
          image_public_id = excluded.image_public_id;
    select id into mini_golf from public.subcategories where parent_category_id = zagadki_gry and slug = 'mini-golf';
  end if;

  if old_escape_room is not null then
    insert into public.subcategories (
      parent_category_id, name, slug, icon, description, image_url, image_public_id
    )
    select zagadki_gry, 'Escape Room', 'escape-room', icon, description, image_url, image_public_id
    from public.categories where id = old_escape_room
    on conflict (parent_category_id, slug) do update
      set name = excluded.name,
          icon = excluded.icon,
          description = excluded.description,
          image_url = excluded.image_url,
          image_public_id = excluded.image_public_id;
    select id into escape_room from public.subcategories where parent_category_id = zagadki_gry and slug = 'escape-room';
  end if;

  if old_paintball is not null and paintball is null then raise exception 'Paintball activity migration failed'; end if;
  if old_gokarty is not null and gokarty is null then raise exception 'Gokarty activity migration failed'; end if;
  if old_dmuchance is not null and dmuchance is null then raise exception 'Dmuchańce activity migration failed'; end if;
  if old_mini_golf is not null and mini_golf is null then raise exception 'Mini Golf activity migration failed'; end if;
  if old_escape_room is not null and escape_room is null then raise exception 'Escape Room activity migration failed'; end if;

  update public.properties
    set category_id = adrenalina, subcategory_id = paintball
    where old_paintball is not null and category_id = old_paintball;
  update public.properties
    set category_id = adrenalina, subcategory_id = gokarty
    where old_gokarty is not null and category_id = old_gokarty;
  update public.properties
    set category_id = dzieci_rodzina, subcategory_id = dmuchance
    where old_dmuchance is not null and category_id = old_dmuchance;
  update public.properties
    set category_id = zagadki_gry, subcategory_id = mini_golf
    where old_mini_golf is not null and category_id = old_mini_golf;
  update public.properties
    set category_id = zagadki_gry, subcategory_id = escape_room
    where old_escape_room is not null and category_id = old_escape_room;

  update public.supply_leads
    set category_id = adrenalina, subcategory_id = paintball
    where old_paintball is not null and category_id = old_paintball;
  update public.supply_leads
    set category_id = adrenalina, subcategory_id = gokarty
    where old_gokarty is not null and category_id = old_gokarty;
  update public.supply_leads
    set category_id = dzieci_rodzina, subcategory_id = dmuchance
    where old_dmuchance is not null and category_id = old_dmuchance;
  update public.supply_leads
    set category_id = zagadki_gry, subcategory_id = mini_golf
    where old_mini_golf is not null and category_id = old_mini_golf;
  update public.supply_leads
    set category_id = zagadki_gry, subcategory_id = escape_room
    where old_escape_room is not null and category_id = old_escape_room;

  update public.supply_campaigns
    set category_id = adrenalina, subcategory_id = paintball
    where old_paintball is not null and category_id = old_paintball;
  update public.supply_campaigns
    set category_id = adrenalina, subcategory_id = gokarty
    where old_gokarty is not null and category_id = old_gokarty;
  update public.supply_campaigns
    set category_id = dzieci_rodzina, subcategory_id = dmuchance
    where old_dmuchance is not null and category_id = old_dmuchance;
  update public.supply_campaigns
    set category_id = zagadki_gry, subcategory_id = mini_golf
    where old_mini_golf is not null and category_id = old_mini_golf;
  update public.supply_campaigns
    set category_id = zagadki_gry, subcategory_id = escape_room
    where old_escape_room is not null and category_id = old_escape_room;

  update public.supply_attribute_definitions
    set category_id = adrenalina, subcategory_id = paintball
    where old_paintball is not null and category_id = old_paintball;
  update public.supply_attribute_definitions
    set category_id = adrenalina, subcategory_id = gokarty
    where old_gokarty is not null and category_id = old_gokarty;
  update public.supply_attribute_definitions
    set category_id = dzieci_rodzina, subcategory_id = dmuchance
    where old_dmuchance is not null and category_id = old_dmuchance;
  update public.supply_attribute_definitions
    set category_id = zagadki_gry, subcategory_id = mini_golf
    where old_mini_golf is not null and category_id = old_mini_golf;
  update public.supply_attribute_definitions
    set category_id = zagadki_gry, subcategory_id = escape_room
    where old_escape_room is not null and category_id = old_escape_room;

  update public.product_attribute_definitions
    set category_id = adrenalina, subcategory_id = paintball
    where old_paintball is not null and category_id = old_paintball;
  update public.product_attribute_definitions
    set category_id = adrenalina, subcategory_id = gokarty
    where old_gokarty is not null and category_id = old_gokarty;
  update public.product_attribute_definitions
    set category_id = dzieci_rodzina, subcategory_id = dmuchance
    where old_dmuchance is not null and category_id = old_dmuchance;
  update public.product_attribute_definitions
    set category_id = zagadki_gry, subcategory_id = mini_golf
    where old_mini_golf is not null and category_id = old_mini_golf;
  update public.product_attribute_definitions
    set category_id = zagadki_gry, subcategory_id = escape_room
    where old_escape_room is not null and category_id = old_escape_room;

  if old_paintball is not null then
    update public.categories set name = 'Legacy: Paintball', slug = 'legacy-paintball', catalog_visible = false where id = old_paintball;
  end if;
  if old_gokarty is not null then
    update public.categories set name = 'Legacy: Go-Karts', slug = 'legacy-go-karts', catalog_visible = false where id = old_gokarty;
  end if;
  if old_dmuchance is not null then
    update public.categories set name = 'Legacy: Dmuchańce', slug = 'legacy-dmuchance', catalog_visible = false where id = old_dmuchance;
  end if;
  if old_mini_golf is not null then
    update public.categories set name = 'Legacy: Mini Golf', slug = 'legacy-mini-golf', catalog_visible = false where id = old_mini_golf;
  end if;
  if old_escape_room is not null then
    update public.categories set name = 'Legacy: Escape Room', slug = 'legacy-escape-room', catalog_visible = false where id = old_escape_room;
  end if;
end
$$;

create or replace function public.catalog_enforce_category_activity_pair()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.subcategory_id is not null then
    if new.category_id is null or not exists (
      select 1
      from public.subcategories activity
      where activity.id = new.subcategory_id
        and activity.parent_category_id = new.category_id
    ) then
      raise exception 'subcategory_id must belong to category_id'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.catalog_enforce_category_activity_pair()
  from public, anon, authenticated;

drop trigger if exists properties_category_activity_pair on public.properties;
create trigger properties_category_activity_pair
before insert or update of category_id, subcategory_id on public.properties
for each row execute function public.catalog_enforce_category_activity_pair();

drop trigger if exists supply_leads_category_activity_pair on public.supply_leads;
create trigger supply_leads_category_activity_pair
before insert or update of category_id, subcategory_id on public.supply_leads
for each row execute function public.catalog_enforce_category_activity_pair();

drop trigger if exists supply_campaigns_category_activity_pair on public.supply_campaigns;
create trigger supply_campaigns_category_activity_pair
before insert or update of category_id, subcategory_id on public.supply_campaigns
for each row execute function public.catalog_enforce_category_activity_pair();

drop trigger if exists supply_attribute_definitions_category_activity_pair on public.supply_attribute_definitions;
create trigger supply_attribute_definitions_category_activity_pair
before insert or update of category_id, subcategory_id on public.supply_attribute_definitions
for each row execute function public.catalog_enforce_category_activity_pair();

drop trigger if exists product_attribute_definitions_category_activity_pair on public.product_attribute_definitions;
create trigger product_attribute_definitions_category_activity_pair
before insert or update of category_id, subcategory_id on public.product_attribute_definitions
for each row execute function public.catalog_enforce_category_activity_pair();

comment on function public.catalog_enforce_category_activity_pair() is
  'Maintains the canonical relation: every selected activity must belong to its category wrapper.';
