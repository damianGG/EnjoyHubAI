import { readdir, readFile } from "node:fs/promises"

import { PGlite } from "@electric-sql/pglite"

const repositoryRoot = new URL("../", import.meta.url)
const database = new PGlite()

async function sqlFiles(relativeDirectory) {
  const directoryUrl = new URL(relativeDirectory, repositoryRoot)
  const names = await readdir(directoryUrl)
  return names
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, url: new URL(name, directoryUrl) }))
}

function normalizeForPGlite(sql) {
  return sql.replace(
    /create\s+extension\s+if\s+not\s+exists\s+(?:pgcrypto|pg_net|pg_cron)\s*;/gi,
    "-- PGlite: Supabase extension bootstrap skipped; compatible test stubs are preloaded.",
  )
}

async function runSqlFiles(label, files) {
  for (const file of files) {
    try {
      const sql = normalizeForPGlite(await readFile(file.url, "utf8"))
      await database.exec(sql)
      process.stdout.write(`${label} OK: ${file.name}\n`)
    } catch (error) {
      console.error(`${label} FAILED: ${file.name}`)
      throw error
    }
  }
}

try {
  // Minimal Supabase-compatible roles and auth objects needed by the canonical
  // ticketing migrations. No application or production data is touched.
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create publication supabase_realtime;
    create schema auth;
    create schema extensions;
    create schema cron;
    create schema vault;
    create function extensions.gen_random_uuid()
    returns uuid
    language sql
    volatile
    as $$ select gen_random_uuid() $$;
    create function extensions.gen_random_bytes(byte_count integer)
    returns bytea
    language sql
    volatile
    as $$ select decode(repeat('00', greatest(byte_count, 0)), 'hex') $$;
    create function cron.schedule(job_name text, schedule text, command text)
    returns bigint
    language sql
    as $$ select 1::bigint $$;
    create table vault.secrets (
      id uuid primary key default gen_random_uuid(),
      name text unique not null,
      secret text not null,
      description text,
      created_at timestamptz not null default now()
    );
    create view vault.decrypted_secrets as
    select id, name, secret as decrypted_secret, description, created_at
    from vault.secrets;
    create function vault.create_secret(secret text, name text, description text default null)
    returns uuid
    language plpgsql
    as $$
    declare
      secret_id uuid;
    begin
      insert into vault.secrets (secret, name, description)
      values (secret, name, description)
      returning id into secret_id;
      return secret_id;
    end;
    $$;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    insert into auth.users (id, email)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pglite@example.com');
    create table public.users (
      id uuid primary key,
      email text unique not null,
      full_name text,
      role text not null default 'user',
      is_host boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.categories (
      id uuid primary key default gen_random_uuid(),
      name text unique not null,
      slug text unique not null,
      icon text not null,
      description text,
      image_url text,
      image_public_id text,
      created_at timestamptz not null default now()
    );
    create table public.subcategories (
      id uuid primary key default gen_random_uuid(),
      parent_category_id uuid not null references public.categories(id) on delete cascade,
      name text not null,
      slug text not null,
      icon text,
      description text,
      image_url text,
      image_public_id text,
      created_at timestamptz not null default now(),
      unique (parent_category_id, slug)
    );
    create table public.properties (
      id uuid primary key default gen_random_uuid(),
      host_id uuid references public.users(id) on delete cascade,
      title text not null,
      description text,
      property_type text not null,
      category_id uuid references public.categories(id),
      subcategory_id uuid,
      address text not null,
      city text not null,
      country text not null,
      latitude numeric(10, 8),
      longitude numeric(11, 8),
      price_per_night numeric(10, 2) not null,
      max_guests integer not null default 1,
      amenities text[],
      images text[],
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.offers (
      id uuid primary key default gen_random_uuid(),
      place_id uuid not null references public.properties(id) on delete cascade,
      title text not null,
      description text,
      base_price numeric(10, 2) not null,
      currency text not null default 'PLN',
      duration_minutes integer not null,
      min_participants integer,
      max_participants integer,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.offer_availability (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references public.offers(id) on delete cascade,
      weekday integer not null check (weekday between 0 and 6),
      start_time time not null,
      end_time time not null check (end_time > start_time),
      slot_length_minutes integer not null,
      max_bookings_per_slot integer not null default 1,
      created_at timestamptz not null default now()
    );
    create table public.offer_bookings (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references public.offers(id) on delete cascade,
      place_id uuid not null references public.properties(id) on delete cascade,
      booking_date date not null,
      start_time time not null,
      end_time time not null check (end_time > start_time),
      persons integer not null,
      status text not null default 'pending',
      payment_status text not null default 'not_required',
      customer_name text not null,
      customer_email text not null,
      customer_phone text,
      user_id uuid references public.users(id) on delete set null,
      source text not null default 'online_enjoyhub',
      created_at timestamptz not null default now()
    );
    create table public.reviews (
      id uuid primary key default gen_random_uuid(),
      property_id uuid references public.properties(id) on delete cascade,
      guest_id uuid references public.users(id) on delete cascade,
      booking_id uuid,
      rating integer check (rating between 1 and 5),
      comment text,
      created_at timestamptz not null default now()
    );
    create table public.category_fields (
      id uuid primary key default gen_random_uuid(),
      category_id uuid references public.categories(id) on delete cascade,
      field_name text not null,
      field_label text not null,
      field_type text not null,
      field_order integer not null default 0,
      is_required boolean not null default false,
      validation_rules jsonb not null default '{}'::jsonb,
      options jsonb not null default '[]'::jsonb,
      placeholder text,
      help_text text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (category_id, field_name)
    );
    create table public.object_field_values (
      id uuid primary key default gen_random_uuid(),
      property_id uuid references public.properties(id) on delete cascade,
      field_id uuid references public.category_fields(id) on delete cascade,
      value text,
      file_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (property_id, field_id)
    );
    alter table public.categories enable row level security;
    alter table public.subcategories enable row level security;
    alter table public.category_fields enable row level security;
    alter table public.offers enable row level security;
    alter table public.offer_availability enable row level security;
    alter table public.offer_bookings enable row level security;
    alter table public.reviews enable row level security;
    insert into public.users (id, email, full_name)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'pglite@example.com',
      'PGlite Test User'
    );
  `)

  await runSqlFiles(
    "migration",
    await sqlFiles("supabase/migrations/"),
  )
  await runSqlFiles(
    "smoke",
    await sqlFiles("supabase/tests/database/"),
  )
} finally {
  await database.close()
}
