begin;

-- Supply field definitions gain enough metadata to drive AI prompts and future filters.
alter table public.supply_attribute_definitions
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists filterable boolean not null default false,
  add column if not exists unit text;

alter table public.supply_attribute_definitions
  drop constraint if exists supply_attribute_definitions_options_check;
alter table public.supply_attribute_definitions
  add constraint supply_attribute_definitions_options_check
  check (jsonb_typeof(options) = 'array');

-- Product-level category-specific fields describe keys stored in products.restrictions.
-- Core commercial data stays in canonical ticketing columns:
-- duration_minutes, min/max_participants and ticket_types.price_amount.
create table if not exists public.product_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,80}$'),
  label text not null,
  value_type text not null check (value_type in ('text','number','boolean','select','textarea')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  unit text,
  required boolean not null default false,
  filterable boolean not null default false,
  ai_prompt text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key)
);

comment on table public.product_attribute_definitions is
  'Category-specific product/package fields. Values are stored under products.restrictions using definition.key.';

alter table public.product_attribute_definitions enable row level security;
revoke all on public.product_attribute_definitions from public, anon, authenticated;

create index if not exists product_attribute_definitions_category_idx
  on public.product_attribute_definitions (category_id, active, sort_order);

-- Paintball object / venue fields. They describe the place, not a single sellable package.
with paintball as (
  select id as category_id from public.categories where slug = 'paintball' limit 1
), fields(key, label, value_type, options, unit, required_for_completeness, filterable, ai_prompt, sort_order) as (
  values
    ('field_count', 'Liczba pól', 'number', '[]'::jsonb, 'pól', true, false, 'Ustal ile osobnych pól lub aren paintballowych operator udostępnia.', 10),
    ('field_area_m2', 'Łączna powierzchnia pól', 'number', '[]'::jsonb, 'm²', false, false, 'Znajdź łączną powierzchnię terenu gry w m². Jeśli źródło podaje hektary, przelicz na m².', 20),
    ('environment_type', 'Rodzaj obiektu', 'select', '["outdoor","indoor","mixed"]'::jsonb, null, true, true, 'Wybierz dokładnie jedną wartość: outdoor, indoor albo mixed.', 30),
    ('terrain_forest', 'Teren leśny', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator ma pole leśne lub grę prowadzoną w lesie?', 40),
    ('terrain_cqb', 'CQB / budynki', 'boolean', '[]'::jsonb, null, false, true, 'Czy dostępny jest teren CQB, wnętrza budynków lub zabudowania do gry?', 50),
    ('terrain_urban', 'Teren urban / miejski', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator opisuje pole jako urban, miejskie, fabryczne lub podobne?', 60),
    ('terrain_bunkers', 'Bunkry / okopy', 'boolean', '[]'::jsonb, null, false, true, 'Czy pole ma bunkry, okopy albo fortyfikacje jako istotny element rozgrywki?', 70),
    ('max_players_simultaneously', 'Maksymalna liczba graczy jednocześnie', 'number', '[]'::jsonb, 'os.', true, true, 'Znajdź maksymalną liczbę osób, które mogą jednocześnie brać udział w grze na obiekcie.', 80),
    ('kids_paintball_available', 'Paintball dla dzieci', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator ma odrębną ofertę paintballa dziecięcego, Gotcha, Splatmaster lub podobną?', 90),
    ('low_impact_available', 'Low impact 0.50', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator oferuje paintball low impact / kaliber .50?', 100),
    ('classic_paintball_available', 'Klasyczny paintball 0.68', 'boolean', '[]'::jsonb, null, true, true, 'Czy operator oferuje klasyczny paintball markerami kalibru .68?', 110),
    ('field_exclusive_available', 'Pole na wyłączność', 'boolean', '[]'::jsonb, null, true, true, 'Czy grupa może zarezerwować pole lub rozgrywkę na wyłączność?', 120),
    ('year_round', 'Całoroczne', 'boolean', '[]'::jsonb, null, true, true, 'Czy operator deklaruje możliwość gry przez cały rok?', 130),
    ('play_in_bad_weather', 'Gra przy gorszej pogodzie', 'boolean', '[]'::jsonb, null, false, true, 'Czy oferta działa również przy deszczu/chłodzie albo operator ma warunki pozwalające grać przy gorszej pogodzie?', 140),
    ('own_equipment_allowed', 'Można grać własnym sprzętem', 'boolean', '[]'::jsonb, null, false, false, 'Czy gracze mogą przyjechać z własnym markerem i wyposażeniem?', 150),
    ('parking_available', 'Parking', 'boolean', '[]'::jsonb, null, false, true, 'Czy przy obiekcie jest parking dla klientów?', 160),
    ('toilet_available', 'Toaleta', 'boolean', '[]'::jsonb, null, false, false, 'Czy na miejscu dostępna jest toaleta dla uczestników?', 170),
    ('covered_rest_area', 'Zadaszona strefa odpoczynku', 'boolean', '[]'::jsonb, null, false, false, 'Czy operator ma wiatę, altanę, namiot lub inną zadaszoną strefę odpoczynku?', 180),
    ('grill_or_bonfire_available', 'Grill / ognisko', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator umożliwia grill, ognisko albo organizuje taką opcję po grze?', 190),
    ('catering_available', 'Catering', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator oferuje catering lub zorganizowane jedzenie jako dodatek?', 200),
    ('birthday_party', 'Urodziny', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator promuje ofertę urodzinową?', 210),
    ('corporate_event', 'Integracje firmowe', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator organizuje imprezy integracyjne lub eventy firmowe?', 220),
    ('bachelor_party', 'Wieczory kawalerskie / panieńskie', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator oferuje lub promuje paintball na wieczory kawalerskie/panieńskie?', 230),
    ('school_groups', 'Grupy szkolne', 'boolean', '[]'::jsonb, null, false, true, 'Czy operator przyjmuje szkoły, klasy lub zorganizowane grupy młodzieżowe?', 240)
)
insert into public.supply_attribute_definitions (
  category_id, key, label, value_type, options, unit,
  required_for_completeness, filterable, ai_prompt, sort_order, active
)
select
  paintball.category_id, fields.key, fields.label, fields.value_type, fields.options, fields.unit,
  fields.required_for_completeness, fields.filterable, fields.ai_prompt, fields.sort_order, true
from paintball cross join fields
on conflict (category_id, key) where category_id is not null and subcategory_id is null
do update set
  label = excluded.label,
  value_type = excluded.value_type,
  options = excluded.options,
  unit = excluded.unit,
  required_for_completeness = excluded.required_for_completeness,
  filterable = excluded.filterable,
  ai_prompt = excluded.ai_prompt,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

-- Paintball package fields. Values belong to products.restrictions.
with paintball as (
  select id as category_id from public.categories where slug = 'paintball' limit 1
), fields(key, label, value_type, options, unit, required, filterable, ai_prompt, sort_order) as (
  values
    ('pricing_model', 'Model ceny', 'select', '["per_person","per_group"]'::jsonb, null, true, false, 'Czy podana cena jest za osobę czy za całą grupę?', 10),
    ('paintball_variant', 'Wariant paintballa', 'select', '["classic_068","low_impact_050","gotcha","gel_blaster","laser_paintball"]'::jsonb, null, true, true, 'Wybierz właściwy wariant produktu. Nie zgaduj na podstawie samej nazwy.', 20),
    ('min_age', 'Minimalny wiek', 'number', '[]'::jsonb, 'lat', true, true, 'Minimalny wiek uczestnika dla tego konkretnego pakietu.', 30),
    ('balls_included', 'Kulki w cenie', 'number', '[]'::jsonb, 'szt.', false, true, 'Liczba kulek przypadająca na jednego uczestnika w cenie pakietu.', 40),
    ('unlimited_balls', 'Kulki bez limitu', 'boolean', '[]'::jsonb, null, false, true, 'Czy pakiet zawiera nielimitowaną amunicję?', 50),
    ('extra_balls_quantity', 'Porcja dodatkowych kulek', 'number', '[]'::jsonb, 'szt.', false, false, 'Ile kulek obejmuje jedna pozycja dokupienia amunicji?', 60),
    ('extra_balls_price', 'Cena dodatkowych kulek', 'number', '[]'::jsonb, 'PLN', false, false, 'Cena porcji dodatkowych kulek wskazanej w extra_balls_quantity.', 70),
    ('caliber', 'Kaliber', 'select', '["0.68","0.50","other","not_applicable"]'::jsonb, null, false, true, 'Kaliber używany w tym pakiecie; dla laser paintball / gel blaster wybierz not_applicable.', 80),
    ('marker_type', 'Model markera', 'text', '[]'::jsonb, null, false, false, 'Model lub typ markera, jeśli operator go podaje.', 90),
    ('field_exclusive', 'Pole na wyłączność w pakiecie', 'boolean', '[]'::jsonb, null, false, true, 'Czy ten konkretny pakiet gwarantuje grupie pole/rozgrywkę na wyłączność?', 100),
    ('equipment_included', 'Sprzęt podstawowy w cenie', 'boolean', '[]'::jsonb, null, true, true, 'Czy cena obejmuje podstawowy sprzęt potrzebny do gry? Szczegóły sprzętu zapisuj również w products.includes.', 110),
    ('instructor_included', 'Instruktor w cenie', 'boolean', '[]'::jsonb, null, false, false, 'Czy pakiet zawiera instruktora/opiekuna prowadzącego?', 120),
    ('referee_included', 'Sędzia w cenie', 'boolean', '[]'::jsonb, null, false, false, 'Czy pakiet obejmuje sędziego prowadzącego rozgrywkę?', 130),
    ('unlimited_air', 'Powietrze / CO2 bez limitu', 'boolean', '[]'::jsonb, null, false, false, 'Czy doładowania powietrza lub CO2 są nielimitowane w cenie?', 140)
)
insert into public.product_attribute_definitions (
  category_id, key, label, value_type, options, unit,
  required, filterable, ai_prompt, sort_order, active
)
select
  paintball.category_id, fields.key, fields.label, fields.value_type, fields.options, fields.unit,
  fields.required, fields.filterable, fields.ai_prompt, fields.sort_order, true
from paintball cross join fields
on conflict (category_id, key)
do update set
  label = excluded.label,
  value_type = excluded.value_type,
  options = excluded.options,
  unit = excluded.unit,
  required = excluded.required,
  filterable = excluded.filterable,
  ai_prompt = excluded.ai_prompt,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

-- Keep the old public marketplace's Paintball fields useful while the marketplace
-- is being migrated. We only update the existing overlapping fields; Supply is canonical.
update public.category_fields field
set field_label = 'Minimalny wiek (orientacyjnie)',
    field_order = 1,
    is_required = false,
    placeholder = 'np. 7',
    help_text = 'Wiek zależy od konkretnego pakietu; dokładna wartość powinna być zapisana przy ofercie.'
from public.categories category
where category.id = field.category_id
  and category.slug = 'paintball'
  and field.field_name = 'minimum_age';

update public.category_fields field
set field_label = 'Powierzchnia pola (ha)',
    field_order = 2,
    is_required = false,
    placeholder = 'np. 2,5',
    help_text = 'Łączna powierzchnia dostępnego terenu gry.'
from public.categories category
where category.id = field.category_id
  and category.slug = 'paintball'
  and field.field_name = 'field_size';

update public.category_fields field
set field_label = 'Indoor / outdoor',
    field_order = 3,
    is_required = true,
    options = '["Indoor","Outdoor","Mixed"]'::jsonb,
    help_text = 'Czy rozgrywka odbywa się pod dachem, na zewnątrz czy w obu wariantach.'
from public.categories category
where category.id = field.category_id
  and category.slug = 'paintball'
  and field.field_name = 'indoor_outdoor';

commit;
