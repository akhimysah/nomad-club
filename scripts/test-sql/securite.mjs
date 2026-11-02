// Lot 6 — vérifications de la migration 0008_securite.sql (consentements, suppression de compte,
// anonymisation, push, limitation de fréquence, double authentification exigée par la base, journal).
// Appelé par scripts/test-sql.mjs avec le banc PGlite déjà migré et rempli.

/**
 * @param {{ db: import("@electric-sql/pglite").PGlite, ok: (c: boolean, l: string) => void, uuid: (id: string) => string }} ctx
 */
export default async function securite({ db, ok, uuid }) {
  const JULIA = uuid("p-julia");
  const NORA = uuid("p-nora");
  const INES = uuid("p-ines");
  const LOU = uuid("p-lou");

  /** Exécute `fn` en tant que `userId` (ou anonyme), avec des claims JWT optionnels, puis annule. */
  async function asUser(userId, fn, claims = {}) {
    return db.transaction(async (tx) => {
      const role = userId ? "authenticated" : "anon";
      await tx.query(
        "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true), set_config('request.jwt.claims', $3, true)",
        [userId ?? "", role, JSON.stringify({ sub: userId ?? "", role, ...claims })],
      );
      await tx.exec(`set local role ${role}`);
      const out = await fn(tx);
      await tx.rollback();
      return out;
    });
  }
  async function safe(userId, fn, claims) {
    try {
      return await asUser(userId, fn, claims);
    } catch (e) {
      console.log(`    erreur SQL : ${e.message}`);
      return undefined;
    }
  }
  async function rejects(userId, sql, params = [], claims) {
    try {
      await asUser(userId, (tx) => tx.query(sql, params), claims);
      return false;
    } catch {
      return true;
    }
  }
  const one = async (tx, sql, params = []) => (await tx.query(sql, params)).rows[0];
  const count = async (tx, sql, params = []) => Number(Object.values((await tx.query(sql, params)).rows[0])[0]);

  console.log("\nLot 6 · Consentements");
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("insert into public.consents (profile_id, kind, granted) values ($1, 'geolocation', true), ($1, 'geolocation', false)", [INES]);
      return (await one(tx, "select granted from public.current_consents where profile_id = $1 and kind = 'geolocation'", [INES])).granted;
    })) === false,
    "Inès enregistre ses choix ; l'état courant est le dernier choix",
  );
  ok(await rejects(INES, "insert into public.consents (profile_id, kind, granted) values ($1, 'image', true)", [JULIA]), "Inès ne consent pas à la place de Julia");
  ok(
    (await safe(INES, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.consents (profile_id, kind, granted) values ($1, 'image', true), ($2, 'image', true)", [INES, LOU]);
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.consents where profile_id <> $1", [INES]);
    })) === 0,
    "Inès ne voit que ses consentements",
  );
  ok(
    (await safe(JULIA, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.consents (profile_id, kind, granted) values ($1, 'image', true)", [LOU]);
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.consents where profile_id = $1", [LOU]);
    })) === 1,
    "Julia (admin) consulte les consentements",
  );
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("insert into public.consents (profile_id, kind, granted) values ($1, 'communications', true)", [INES]);
      try {
        await tx.query("savepoint s");
        await tx.query("update public.consents set granted = false where profile_id = $1", [INES]);
        return false;
      } catch {
        await tx.query("rollback to savepoint s");
        return true;
      }
    })) === true,
    "l'historique des consentements n'est pas modifiable",
  );
  ok(await rejects(null, "select * from public.consents"), "anonyme : consentements interdits");
  ok(
    (await safe(INES, async (tx) => {
      const a = (await one(tx, "select public.has_consent($1, 'directory') as v", [LOU])).v;
      const b = (await one(tx, "select public.has_consent($1, 'geolocation') as v", [LOU])).v;
      return a === true && b === false;
    })) === true,
    "has_consent : annuaire visible par défaut, géolocalisation refusée par défaut",
  );

  console.log("\nLot 6 · Suppression de compte");
  ok(
    (await safe(INES, async (tx) => {
      const a = await one(tx, "select (public.request_account_deletion('Je quitte Marrakech')).id as id");
      const b = await one(tx, "select (public.request_account_deletion(null)).id as id");
      const n = await count(tx, "select count(*) from public.deletion_requests where profile_id = $1 and status = 'pending'", [INES]);
      const delay = await one(tx, "select extract(day from scheduled_for - requested_at)::int as d from public.deletion_requests where profile_id = $1", [INES]);
      return a.id === b.id && n === 1 && delay.d === 30;
    })) === true,
    "Inès demande la suppression (une seule demande en cours, délai de grâce de 30 jours)",
  );
  ok(
    (await safe(INES, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.deletion_requests (profile_id) values ($1)", [LOU]);
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.deletion_requests");
    })) === 0,
    "Inès ne voit pas la demande de Lou",
  );
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("select public.request_account_deletion(null)");
      await tx.query("update public.deletion_requests set status = 'done' where profile_id = $1", [INES]);
      return (await one(tx, "select status from public.deletion_requests where profile_id = $1", [INES])).status;
    })) === "pending",
    "Inès ne traite pas elle-même sa demande",
  );
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("select public.request_account_deletion(null)");
      const c = (await one(tx, "select public.cancel_account_deletion() as v")).v;
      return c && (await one(tx, "select status from public.deletion_requests where profile_id = $1", [INES])).status === "cancelled";
    })) === true,
    "Inès annule sa demande pendant le délai de grâce",
  );
  ok(await rejects(null, "select public.request_account_deletion(null)"), "anonyme : pas de demande de suppression");
  ok(
    (await safe(JULIA, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.deletion_requests (profile_id) values ($1)", [LOU]);
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.deletion_requests where status = 'pending'");
    })) === 1,
    "seules les administratrices voient la file de suppression",
  );
  ok(
    (await safe(LOU, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.deletion_requests (profile_id) values ($1)", [INES]);
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.deletion_requests");
    })) === 0,
    "…une autre membre ne la voit pas",
  );
  ok(
    (await safe(INES, async (tx) => {
      const r = await one(tx, "select count(*)::int as n from public.audit_log");
      await tx.query("select public.request_account_deletion(null)");
      await tx.exec("reset role");
      return (await one(tx, "select count(*)::int as n from public.audit_log where action = 'account.delete_request' and actor_id = $1", [INES])).n === 1 && r.n === 0;
    })) === true,
    "la demande est inscrite au journal",
  );

  console.log("\nLot 6 · Anonymisation");
  ok(await rejects(INES, "select public.anonymize_account($1)", [LOU]), "Inès n'anonymise pas un compte");
  ok(await rejects(JULIA, "select public.anonymize_account($1)", [NORA]), "un compte administratrice n'est pas anonymisé");
  ok(await rejects(JULIA, "select public.anonymize_account($1)", [JULIA]), "on ne s'anonymise pas soi-même");
  ok(
    (await safe(JULIA, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.deletion_requests (profile_id) values ($1)", [INES]);
      await tx.query("insert into public.consents (profile_id, kind, granted) values ($1, 'image', true)", [INES]);
      const paysBefore = await count(tx, "select count(*) from public.payments where profile_id = $1", [INES]);
      const msgs = await count(tx, "select count(*) from public.messages where author_id = $1", [INES]);
      await tx.exec("set local role authenticated");
      await tx.query("select public.anonymize_account($1)", [INES]);
      await tx.exec("reset role");
      const p = await one(tx, "select first_name, last_name, email, whatsapp, plan from public.profiles where id = $1", [INES]);
      const paysAfter = await count(tx, "select count(*) from public.payments where profile_id = $1", [INES]);
      const kept = await count(tx, "select count(*) from public.messages where author_id = $1 and body <> 'Message retiré (compte supprimé).'", [INES]);
      const roles = await count(tx, "select count(*) from public.user_roles where profile_id = $1", [INES]);
      const consents = await count(tx, "select count(*) from public.consents where profile_id = $1", [INES]);
      const req = await one(tx, "select status, processed_by from public.deletion_requests where profile_id = $1", [INES]);
      return (
        p.first_name === "Ancienne" && p.email === null && p.whatsapp === null && p.plan === "free" &&
        paysBefore > 0 && paysAfter === paysBefore && msgs > 0 && kept === 0 && roles === 0 && consents === 0 &&
        req.status === "done" && req.processed_by === JULIA
      );
    })) === true,
    "Julia anonymise Inès : coordonnées et messages effacés, paiements conservés, demande close",
  );

  console.log("\nLot 6 · Double authentification exigée par la base");
  ok(
    (await safe(JULIA, async (tx) => {
      await tx.exec("reset role");
      await tx.query("update public.security_settings set admin_mfa_enforced = true");
      await tx.exec("set local role authenticated");
      const journal = await count(tx, "select count(*) from public.audit_log");
      await tx.query("delete from public.user_roles where profile_id = $1 and role = 'member'", [LOU]);
      await tx.exec("reset role");
      const lou = await count(tx, "select count(*) from public.user_roles where profile_id = $1", [LOU]);
      return journal === 0 && lou === 1;
    }, { aal: "aal1" })) === true,
    "AAL1 : une admin ne lit pas le journal et ne retire pas de rôle",
  );
  ok(
    (await safe(JULIA, async (tx) => {
      await tx.exec("reset role");
      await tx.query("update public.security_settings set admin_mfa_enforced = true");
      await tx.exec("set local role authenticated");
      const journal = await count(tx, "select count(*) from public.audit_log");
      await tx.query("delete from public.user_roles where profile_id = $1 and role = 'member'", [LOU]);
      await tx.exec("reset role");
      const lou = await count(tx, "select count(*) from public.user_roles where profile_id = $1", [LOU]);
      return journal > 0 && lou === 0;
    }, { aal: "aal2" })) === true,
    "AAL2 : tout redevient possible",
  );
  ok(
    (await safe(INES, async (tx) => {
      await tx.exec("reset role");
      await tx.query("update public.security_settings set admin_mfa_enforced = true");
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.bookings where profile_id = $1", [INES]);
    }, { aal: "aal1" })) > 0,
    "…sans gêner une membre",
  );
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("update public.security_settings set admin_mfa_enforced = true");
      await tx.exec("reset role");
      return (await one(tx, "select admin_mfa_enforced as v from public.security_settings")).v;
    })) === false,
    "Inès ne touche pas aux réglages de sécurité",
  );

  console.log("\nLot 6 · Journal, push, limitation de fréquence, sessions");
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'data.export', 'profile', $1, 'Export')", [INES]);
      return true;
    })) === true,
    "Inès journalise l'export de ses données",
  );
  ok(await rejects(INES, "insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'data.export', 'profile', $2, 'x')", [INES, LOU]), "…mais pas sur la fiche d'une autre");
  ok(await rejects(INES, "insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'role.grant', 'profile', $1, 'x')", [INES]), "…ni une action d'administration");
  ok(
    (await safe(INES, async (tx) => {
      await tx.query("insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values ($1, 'https://push.example/abc', 'k', 'a')", [INES]);
      await tx.exec("reset role");
      await tx.query("insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values ($1, 'https://push.example/lou', 'k', 'a')", [LOU]);
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.push_subscriptions");
    })) === 1,
    "abonnements push : chacune ne voit que les siens",
  );
  ok(await rejects(INES, "insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values ($1, 'https://push.example/x', 'k', 'a')", [LOU]), "…et n'abonne pas une autre personne");
  ok(await rejects(null, "select public.rate_limit_hit('x', 1, 60)"), "anonyme : pas d'accès direct au compteur de fréquence");
  ok(await rejects(INES, "select * from public.rate_limits"), "membre : table des compteurs inaccessible");
  {
    const r = await db.transaction(async (tx) => {
      const a = (await one(tx, "select public.rate_limit_hit('test:ip:1', 2, 60) as r")).r;
      const b = (await one(tx, "select public.rate_limit_hit('test:ip:1', 2, 60) as r")).r;
      const c = (await one(tx, "select public.rate_limit_hit('test:ip:1', 2, 60) as r")).r;
      await tx.rollback();
      return { a, b, c };
    });
    ok(r.a.ok && r.b.ok && !r.c.ok && r.c.retry_after > 0, "rate_limit_hit refuse au-delà de la limite (avec délai d'attente)");
  }
  ok(await rejects(null, "select public.new_ticket_code(now())"), "fonction interne new_ticket_code non exposée");
  {
    const code = (await db.query("select public.new_ticket_code(now()) as c")).rows[0].c;
    ok(/^NC-\d{4}-[A-Z0-9]{6}$/.test(code), `codes de billet à 6 caractères (${code})`);
  }
  ok(
    (await safe(null, async (tx) => {
      await tx.exec("reset role");
      const c = (await one(tx, "select ticket_code from public.bookings where profile_id is not null limit 1")).ticket_code;
      await tx.exec("set local role anon");
      const t = (await one(tx, "select public.get_ticket($1) as t", [c])).t;
      return t && t.booking.profile_id === null && !!t.holder;
    })) === true,
    "get_ticket n'expose plus l'identifiant du compte",
  );
  await db.exec(`
    create table if not exists auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz default now(), updated_at timestamptz, user_agent text, ip inet, aal text);
    grant select on auth.sessions to postgres;
  `);
  ok(
    (await safe(INES, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into auth.sessions (id, user_id, user_agent, ip, aal) values (gen_random_uuid(), $1, 'iPhone', '10.0.0.1', 'aal1'), (gen_random_uuid(), $2, 'Mac', '10.0.0.2', 'aal2')", [INES, LOU]);
      await tx.exec("set local role authenticated");
      const rows = (await tx.query("select * from public.my_sessions()")).rows;
      return rows.length === 1 && rows[0].user_agent === "iPhone" && rows[0].ip === "10.0.0.1";
    })) === true,
    "my_sessions : Inès ne voit que ses propres sessions",
  );
}
