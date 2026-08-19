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

async function runSqlFiles(label, files) {
  for (const file of files) {
    try {
      await database.exec(await readFile(file.url, "utf8"))
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
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
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
      created_at timestamptz not null default now()
    );
    create table public.properties (
      id uuid primary key default gen_random_uuid(),
      host_id uuid references public.users(id) on delete cascade,
      title text not null,
      description text,
      property_type text not null,
      category_id uuid references public.categories(id),
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
      created_at timestamptz not null default now()
    );
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
