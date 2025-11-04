-- Lekkie rozszerzenia (bez PostGIS)
create extension if not exists cube;
create extension if not exists earthdistance;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Główna tabela (przykład – dostosuj nazwy/typy)
create table if not exists public.places (
  id bigserial primary key,
  name text not null,
  description text,
  category_slug text not null,
  city text,
  region text, -- województwo
  lat double precision not null,
  lng double precision not null,
  has_online_booking boolean default false,
  open_hours jsonb, -- np. {mon:[["10:00","18:00"]], ...}
  price_min numeric,
  price_max numeric,
  rating numeric,
  reviews_count int default 0,
  attributes jsonb default '{}'::jsonb, -- dynamiczne pola, np. {"parking":"free","kids":{"min":5,"max":12},"outdoor":true}
  created_at timestamptz default now()
);

-- Definicje filtrów (budują UI i URL; admin konfiguruje co ma być filtrowalne)
create table if not exists public.attribute_definitions (
  id bigserial primary key,
  key text not null,                   -- np. "parking", "outdoor", "field_type"
  label text not null,                 -- np. "Parking"
  type text not null,                  -- "boolean" | "enum" | "number" | "range" | "string"
  category_slug text,                  -- null = global, albo przypisane do kategorii (np. "paintball")
  options jsonb,                       -- dla enum: ["free","paid","none"], dla range: {"min":0,"max":200}
  active boolean default true,
  sort_order int default 100
);

-- Indeksy pod wyszukiwanie
create index if not exists places_category_idx on public.places (category_slug);
create index if not exists places_lat_idx on public.places (lat);
create index if not exists places_lng_idx on public.places (lng);
create index if not exists places_lat_lng_idx on public.places (lat, lng);

-- KNN po odległości (earthdistance)
create index if not exists places_earth_gist on public.places using gist (ll_to_earth(lat, lng));

-- Tekst
create index if not exists places_name_trgm on public.places using gin (name gin_trgm_ops);
create index if not exists places_desc_trgm on public.places using gin (description gin_trgm_ops);

-- Dynamiczne atrybuty (JSONB)
create index if not exists places_attributes_gin on public.places using gin (attributes jsonb_path_ops);

-- RLS – przykład otwarty do odczytu (dostosuj)
alter table public.places enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='places' AND policyname='read_places'
  ) THEN
    CREATE POLICY read_places ON public.places FOR SELECT USING (true);
  END IF;
END $$;
