// Base PGlite prête pour les tests : schéma « auth » simulé comme Supabase (mêmes règles que
// scripts/test-sql.mjs), toutes les migrations, puis éventuellement supabase/seed.sql.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SUPABASE_AUTH = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz default now(), updated_at timestamptz, user_agent text, ip inet, aal text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export function migrationFiles() {
  const dir = join(root, "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));
}

/** @param {{ seed?: boolean, quiet?: boolean }} opts */
export async function createTestDb(opts = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_AUTH);
  const files = [...migrationFiles(), ...(opts.seed === false ? [] : [join(root, "supabase/seed.sql")])];
  for (const f of files) {
    try {
      await db.exec(readFileSync(f, "utf8"));
      if (!opts.quiet) console.log(`✓ ${f.slice(root.length + 1)}`);
    } catch (e) {
      throw new Error(`${f.slice(root.length + 1)} : ${e.message}`);
    }
  }
  return db;
}
