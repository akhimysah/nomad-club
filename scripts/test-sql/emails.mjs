// Vague 2 · E-mails — vérifications de la migration 0011_emails.sql (journal des envois).
// Appelé par scripts/test-sql.mjs avec le banc PGlite déjà migré et rempli.

/**
 * @param {{ db: import("@electric-sql/pglite").PGlite, ok: (c: boolean, l: string) => void, uuid: (id: string) => string }} ctx
 */
export default async function emails({ db, ok, uuid }) {
  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const LOU = uuid("p-lou");
  const YASMINE = uuid("p-yasmine");

  async function asUser(userId, fn, claims = {}, role = userId ? "authenticated" : "anon") {
    return db.transaction(async (tx) => {
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
  async function safe(userId, fn, claims, role) {
    try {
      return await asUser(userId, fn, claims, role);
    } catch (e) {
      console.log(`    erreur SQL : ${e.message}`);
      return undefined;
    }
  }
  async function rejects(userId, sql, params = [], claims, role) {
    try {
      await asUser(userId, (tx) => tx.query(sql, params), claims, role);
      return false;
    } catch {
      return true;
    }
  }
  const count = async (tx, sql, params = []) => Number(Object.values((await tx.query(sql, params)).rows[0])[0]);

  console.log("\nE-mails · Journal des envois");
  // Écriture par le serveur (rôle propriétaire ici, clé service en production).
  await db.query(
    `insert into public.email_log (profile_id, to_email, template, subject, status, provider, provider_id, data, attachments) values
       ($1, 'ines@exemple.com', 'booking_confirmed', 'Ta place est réservée : Lunch au Fer7', 'sent', 'resend', 're_123', '{"ticketCode":"K7Q2MX"}', '{billet-qr.png,lunch.ics}'),
       ($2, 'lou@exemple.com', 'payment_failed', 'Paiement à régulariser', 'failed', 'resend', null, '{}', '{}')`,
    [INES, LOU],
  );
  ok((await safe(JULIA, (tx) => count(tx, "select count(*) from public.email_log"))) >= 2, "l'administratrice lit le journal des envois");
  ok((await safe(INES, (tx) => count(tx, "select count(*) from public.email_log"))) === 0, "une membre ne lit aucun envoi (même les siens)");
  ok((await safe(YASMINE, (tx) => count(tx, "select count(*) from public.email_log"))) === 0, "une modératrice ne lit pas le journal des envois");
  ok(await rejects(null, "select * from public.email_log"), "anonyme : journal des envois interdit");
  ok(
    await rejects(JULIA, "insert into public.email_log (to_email, template, status, provider) values ('x@y.fr', 'welcome', 'sent', 'console')"),
    "même l'administratrice n'écrit pas dans le journal (serveur seulement)",
  );
  ok(await rejects(JULIA, "update public.email_log set status = 'sent' where status = 'failed'"), "le journal ne se modifie pas");
  ok(await rejects(JULIA, "delete from public.email_log"), "le journal ne s'efface pas à la main");
  ok(
    await rejects(null, "insert into public.email_log (to_email, template, status, provider) values ('x@y.fr', 'Pas Un Modèle', 'sent', 'console')", [], {}, "service_role"),
    "identifiant de modèle contrôlé",
  );
  ok(
    await rejects(null, "insert into public.email_log (to_email, template, status, provider) values ('x@y.fr', 'welcome', 'queued', 'console')", [], {}, "service_role"),
    "statut contrôlé (sent | failed)",
  );
  ok(
    (await safe(
      null,
      async (tx) => {
        await tx.query("insert into public.email_log (to_email, template, status, provider) values ('x@y.fr', 'welcome', 'sent', 'console')");
        return count(tx, "select count(*) from public.email_log where to_email = 'x@y.fr'");
      },
      {},
      "service_role",
    )) === 1,
    "la clé service journalise un envoi",
  );

  // Double authentification exigée par la base : une admin en AAL1 ne lit plus le journal.
  ok(
    (await safe(JULIA, async (tx) => {
      await tx.exec("reset role");
      await tx.query("update public.security_settings set admin_mfa_enforced = true");
      await tx.exec("set local role authenticated");
      return count(tx, "select count(*) from public.email_log");
    })) === 0,
    "2FA exigée : admin en AAL1 → journal des envois masqué",
  );
  ok(
    (await safe(
      JULIA,
      async (tx) => {
        await tx.exec("reset role");
        await tx.query("update public.security_settings set admin_mfa_enforced = true");
        await tx.exec("set local role authenticated");
        return count(tx, "select count(*) from public.email_log");
      },
      { aal: "aal2" },
    )) >= 2,
    "2FA exigée : admin en AAL2 → journal visible",
  );

  // Purge (clé service seulement).
  ok(await rejects(JULIA, "select public.purge_email_log(30)"), "purge_email_log refusée à l'administratrice");
  ok(
    (await safe(
      null,
      async (tx) => {
        await tx.exec("reset role");
        await tx.query("update public.email_log set created_at = now() - interval '400 days' where to_email = 'lou@exemple.com'");
        await tx.query("select set_config('request.jwt.claim.role', 'service_role', true)");
        await tx.exec("set local role service_role");
        const n = (await tx.query("select public.purge_email_log(180) as n")).rows[0].n;
        return n === 1 && (await count(tx, "select count(*) from public.email_log where to_email = 'lou@exemple.com'")) === 0;
      },
      {},
      "service_role",
    )) === true,
    "purge des envois de plus de 180 jours (clé service)",
  );

  // Anonymisation : les envois de la personne disparaissent.
  ok(
    (await safe(
      null,
      async (tx) => {
        await tx.query("select public.anonymize_account($1)", [INES]);
        return count(tx, "select count(*) from public.email_log where profile_id = $1 or to_email = 'ines@exemple.com'", [INES]);
      },
      {},
      "service_role",
    )) === 0,
    "compte anonymisé → ses e-mails sont effacés du journal",
  );
  ok((await count(db, "select count(*) from public.email_log where profile_id = $1", [INES])) === 1, "(hors transaction annulée, l'envoi d'Inès est toujours là)");

  await db.query("delete from public.email_log");
}
