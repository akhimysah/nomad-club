// Banc de test des migrations SQL, sans serveur Postgres : PGlite (Postgres compilé en WebAssembly).
// Simule le schéma « auth » de Supabase (auth.users, auth.uid(), rôles anon / authenticated / service_role),
// exécute les migrations puis supabase/seed.sql, et vérifie les rôles et la sécurité ligne par ligne.
// Utilisation : npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase/migrations");
const files = [
  ...readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(migrationsDir, f)),
  join(root, "supabase/seed.sql"),
];

const SUPABASE_AUTH = `
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
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

let failures = 0;
let passes = 0;
function ok(cond, label) {
  if (cond) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`);
  }
}

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SUPABASE_AUTH);
for (const f of files) {
  const rel = f.slice(root.length + 1);
  try {
    await db.exec(readFileSync(f, "utf8"));
    console.log(`✓ ${rel}`);
  } catch (e) {
    console.error(`✗ ${rel}\n  ${e.message}`);
    process.exit(1);
  }
}

/**
 * Exécute une requête « en tant que » une personne (ou anonyme), dans une transaction annulée ensuite.
 * Une erreur SQL est affichée et donne `undefined` (la vérification échoue sans arrêter le banc).
 */
async function as(userId, fn) {
  try {
    return await asStrict(userId, fn);
  } catch (e) {
    console.log(`    erreur SQL : ${e.message}`);
    return undefined;
  }
}
async function asStrict(userId, fn) {
  return db.transaction(async (tx) => {
    if (userId) {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [userId]);
      await tx.exec("set local role authenticated");
    } else {
      await tx.query("select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true)");
      await tx.exec("set local role anon");
    }
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
async function rejects(userId, sql, params = []) {
  try {
    await asStrict(userId, (tx) => tx.query(sql, params));
    return false;
  } catch {
    return true;
  }
}
const one = async (tx, sql, params = []) => (await tx.query(sql, params)).rows[0];
const count = async (tx, sql, params = []) => Number(Object.values((await tx.query(sql, params)).rows[0])[0]);

const { createHash } = await import("node:crypto");
const uuid = (id) => {
  const h = createHash("md5").update("nomad-club:" + id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const JULIA = uuid("p-julia");
const NORA = uuid("p-nora");
const INES = uuid("p-ines");
const KENZA = uuid("p-g11");
const LOUBNA = uuid("p-g34");
const RIM = uuid("p-rim");
const LOU = uuid("p-lou");
const HANA = uuid("p-hana");
const BLOOM = uuid("org-bloom");
const AMAJ = uuid("org-amaj");

console.log("\nRôles");
ok(!(await one(db, "select count(*)::int as n from information_schema.columns where table_name = 'profiles' and column_name = 'role'")).n, "profiles.role a disparu (remplacé par user_roles)");
ok(!(await one(db, "select count(*)::int as n from pg_proc where proname in ('is_founder', 'is_member')")).n, "is_founder() et is_member() sont supprimées");
ok(
  (await one(db, "select array_agg(role order by role) as r from public.user_roles where profile_id = $1", [JULIA])).r.join() === "admin",
  "Julia est administratrice",
);
ok((await one(db, "select array_agg(role order by role) as r from public.user_roles where profile_id = $1", [KENZA])).r.join() === "member,partner", "Kenza cumule membre + partenaire");
ok((await one(db, "select array_agg(role order by role) as r from public.user_roles where profile_id = $1", [LOUBNA])).r.join() === "member,pro", "Loubna cumule membre + pro");
ok(await as(JULIA, async (tx) => (await one(tx, "select public.has_role('admin') as v")).v), "has_role('admin') vrai pour Julia");
ok(await as(INES, async (tx) => !(await one(tx, "select public.has_role('admin') as v")).v), "has_role('admin') faux pour Inès");
ok(await as(INES, async (tx) => (await one(tx, "select public.has_any_role(array['member', 'pro']) as v")).v), "has_any_role(member, pro) vrai pour Inès");
ok(await as(null, async (tx) => !(await one(tx, "select public.has_role('member') as v")).v), "has_role faux pour une visiteuse anonyme");

console.log("\nSécurité ligne par ligne");
ok(await as(null, (tx) => count(tx, "select count(*) from public.profiles")) === 0, "anonyme : aucun profil visible");
ok(await rejects(null, "select * from public.notifications"), "anonyme : notifications interdites");
const circle = await as(INES, (tx) => count(tx, "select count(*) from public.profiles"));
ok(circle > 50, `Inès voit l'annuaire (${circle} fiches)`);
ok(await as(INES, (tx) => count(tx, "select count(*) from public.profiles where id in ($1, $2)", [RIM, HANA])) === 0, "…mais ni Rim (partenaire seule) ni Hana (compte gratuit)");
ok(await as(RIM, (tx) => count(tx, "select count(*) from public.profiles")) === 1, "Rim (partenaire, non membre) ne voit que sa fiche");
ok(await as(RIM, (tx) => count(tx, "select count(*) from public.events where status = 'published'")) > 0, "les rendez-vous publiés restent publics");
ok(await as(INES, (tx) => count(tx, "select count(*) from public.payments where profile_id <> $1", [INES])) === 0, "Inès ne voit que ses paiements");
ok(await rejects(INES, "insert into public.user_roles (profile_id, role) values ($1, 'admin')", [INES]), "Inès ne peut pas se donner le rôle admin");
ok(await as(JULIA, async (tx) => {
  await tx.query("insert into public.user_roles (profile_id, role, granted_by) values ($1, 'pro', $2)", [INES, JULIA]);
  return count(tx, "select count(*) from public.user_roles where profile_id = $1", [INES]);
}) === 2, "Julia (admin) ajoute le rôle pro à Inès");
ok(await as(JULIA, async (tx) => {
  await tx.query("delete from public.user_roles where profile_id = $1 and role = 'admin'", [NORA]);
  try {
    await tx.query("savepoint s");
    await tx.query("delete from public.user_roles where profile_id = $1 and role = 'admin'", [JULIA]);
    return false;
  } catch {
    await tx.query("rollback to savepoint s");
    return true;
  }
}), "la dernière administratrice ne peut pas être retirée");

console.log("\nOrganisations");
ok(await as(KENZA, (tx) => count(tx, "select count(*) from public.organizations where id = $1", [BLOOM])) === 1, "Kenza voit Bloom House");
ok(await as(KENZA, async (tx) => {
  await tx.query("update public.organizations set description = 'Nouvelle description' where id = $1", [BLOOM]);
  return (await one(tx, "select description from public.organizations where id = $1", [BLOOM])).description === "Nouvelle description";
}), "Kenza (propriétaire) modifie la fiche de Bloom House");
ok(await rejects(KENZA, "update public.organizations set status = 'suspended' where id = $1", [BLOOM]), "…mais pas son statut");
ok(await as(KENZA, async (tx) => {
  await tx.query("update public.organizations set description = 'x' where id = $1", [AMAJ]);
  return (await one(tx, "select description from public.organizations where id = $1", [AMAJ])).description !== "x";
}), "Kenza ne modifie pas Maison Amaj");
ok(await as(RIM, (tx) => count(tx, "select count(*) from public.organizations")) === 1, "Rim ne voit que Maison Amaj");
ok(await as(RIM, (tx) => count(tx, "select count(*) from public.organization_members")) === 1, "Rim ne voit que son rattachement");

console.log("\nJournal des opérations");
ok(await as(JULIA, (tx) => count(tx, "select count(*) from public.audit_log")) >= 7, "Julia lit le journal");
ok(await as(INES, (tx) => count(tx, "select count(*) from public.audit_log")) === 0, "Inès ne lit pas le journal");
ok(await rejects(INES, "insert into public.audit_log (actor_id, action, target_type, summary) values ($1, 'event.publish', 'event', 'x')", [INES]), "Inès n'écrit pas dans le journal");
ok(await rejects(JULIA, "insert into public.audit_log (actor_id, action, target_type, summary) values ($1, 'event.publish', 'event', 'x')", [NORA]), "Julia n'écrit pas au nom de Nora");
ok(await rejects(JULIA, "delete from public.audit_log"), "personne n'efface le journal");

console.log("\nNotifications");
ok(await as(INES, (tx) => count(tx, "select count(*) from public.notifications")) === 2, "Inès voit ses 2 notifications, pas celles des autres");
ok(await rejects(INES, "insert into public.notifications (recipient_id, type, title) values ($1, 'event_published', 'x')", [JULIA]), "Inès ne notifie pas une autre personne");
ok(await as(INES, async (tx) => {
  await tx.query("update public.notifications set read_at = now() where recipient_id = $1", [INES]);
  return count(tx, "select count(*) from public.notifications where read_at is null");
}) === 0, "Inès marque ses notifications comme lues");
ok(await rejects(INES, "update public.notifications set title = 'x' where recipient_id = $1", [INES]), "…sans pouvoir en changer le texte");
ok(await as(LOU, async (tx) => {
  await tx.query("insert into public.notification_prefs (profile_id, type, in_app) values ($1, 'payment_validated', false)", [LOU]);
  return count(tx, "select count(*) from public.notification_prefs where profile_id = $1", [LOU]);
}) === 1, "Lou règle ses préférences");
await db.query("insert into public.notification_prefs (profile_id, type, in_app) values ($1, 'payment_validated', false)", [LOU]);
ok(await as(JULIA, async (tx) => {
  await tx.query("insert into public.notifications (recipient_id, type, title) values ($1, 'payment_validated', 'Coupée'), ($2, 'payment_validated', 'Gardée')", [LOU, INES]);
  await tx.exec("reset role"); // relit en superutilisatrice : Julia ne voit pas les notifications des autres
  return count(tx, "select count(*) from public.notifications where title in ('Coupée', 'Gardée')");
}) === 1, "Julia notifie : la notification coupée par Lou n'est pas créée, celle d'Inès l'est");
ok(await rejects(INES, "insert into public.notification_prefs (profile_id, type, in_app) values ($1, 'event_published', false)", [JULIA]), "chacune ne règle que ses préférences");

console.log("\nFonctions métier");
const declaredId = (await one(db, "select id from public.payments where status = 'declared' and method = 'transfer' limit 1")).id;
ok(await rejects(INES, "select public.validate_payment($1)", [declaredId]), "Inès ne valide pas de virement");
ok(await as(JULIA, async (tx) => {
  const pay = await one(tx, "select id from public.payments where profile_id = $1 and status = 'declared'", [LOU]);
  await tx.query("select public.validate_payment($1)", [pay.id]);
  const roles = await one(tx, "select array_agg(role) as r from public.user_roles where profile_id = $1", [LOU]);
  const st = await one(tx, "select status from public.payments where id = $1", [pay.id]);
  return st.status === "validated" && roles.r.join() === "member";
}), "Julia valide le virement de Lou (adhésion appliquée, rôle membre conservé)");
ok(await as(INES, async (tx) => {
  const b = await one(tx, "select id from public.bookings where profile_id = $1 and status <> 'cancelled' limit 1", [INES]);
  const r = (await one(tx, "select public.cancel_booking($1) as r", [b.id])).r;
  return !!r.event_id;
}), "cancel_booking renvoie le rendez-vous libéré");
ok(await as(JULIA, (tx) => count(tx, "select count(*) from public.founder_actions")) > 0, "la vue founder_actions fonctionne pour une admin");
ok(await as(INES, (tx) => count(tx, "select count(*) from public.founder_actions where kind = 'transfer'")) === 0, "…et ne montre rien à une membre");

// --- Lot 5 ---
await (await import("./test-sql/crm.mjs")).default({ db, as, rejects, ok, one, count, uuid });

console.log("\nReprise du rôle unique (base existante)");
{
  const legacy = await PGlite.create({ extensions: { pgcrypto } });
  await legacy.exec(SUPABASE_AUTH);
  for (const f of files.filter((x) => /0001|0002/.test(x))) await legacy.exec(readFileSync(f, "utf8"));
  await legacy.exec(`
    insert into auth.users (id, email) values
      ('00000000-0000-4000-a000-000000000001', 'f@x.test'), ('00000000-0000-4000-a000-000000000002', 'm@x.test'), ('00000000-0000-4000-a000-000000000003', 'g@x.test');
    select set_config('nc.trusted', 'on', false);
    update public.profiles set role = 'founder' where id = '00000000-0000-4000-a000-000000000001';
    update public.profiles set role = 'member' where id = '00000000-0000-4000-a000-000000000002';
  `);
  await legacy.exec(readFileSync(files.find((x) => x.includes("0003")), "utf8"));
  const rows = (await legacy.query("select profile_id::text as p, role from public.user_roles order by 1")).rows;
  ok(rows.length === 2 && rows[0].role === "admin" && rows[1].role === "member", "founder → admin, member → member, guest → aucun rôle");
  await legacy.close();
}

console.log(`\n${passes} vérification${passes > 1 ? "s" : ""} réussie${passes > 1 ? "s" : ""}, ${failures} échec${failures > 1 ? "s" : ""}.`);
process.exit(failures ? 1 : 0);
