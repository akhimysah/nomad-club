// Lot 5 : vérifications de 0007_crm.sql (CRM). Appelé par scripts/test-sql.mjs.
// Ne suppose pas que supabase/seed.sql contienne déjà les données d'exemple du CRM.

export default async function crmChecks({ db, as, rejects, ok, one, count, uuid }) {
  const JULIA = uuid("p-julia");
  const NORA = uuid("p-nora");
  const INES = uuid("p-ines");
  const KENZA = uuid("p-g11");
  const RIM = uuid("p-rim");
  const LOUBNA = uuid("p-g34");
  const YASMINE = uuid("p-yasmine");
  const TABLES = ["crm_contacts", "crm_stages", "crm_deals", "crm_activities", "crm_tasks", "crm_segments"];

  console.log("\nCRM (Lot 5)");

  // jeu minimal, inséré en superutilisatrice
  const ext = (await one(db, "insert into public.crm_contacts (first_name, last_name, email, source, status, owner_id) values ('Test', 'Prospect', 'prospect@x.test', 'instagram', 'prospect', $1) returning id", [JULIA])).id;
  const stageNew = (await one(db, "select id from public.crm_stages where outcome = 'open' order by position limit 1")).id;
  await db.query("insert into public.crm_deals (contact_id, stage_id, title, value) values ($1, $2, 'Adhésion Membre', 670)", [ext, stageNew]);
  await db.query("insert into public.crm_activities (contact_id, type, body) values ($1, 'call', 'Premier appel')", [ext]);
  await db.query("insert into public.crm_tasks (contact_id, title, due_on, owner_id) values ($1, 'Relancer', current_date, $2)", [ext, JULIA]);
  await db.query("insert into public.crm_segments (name, filters) values ('Test', '{\"expiresWithin\": 30}')");

  const profiles = await count(db, "select count(*) from public.profiles");
  ok(await count(db, "select count(*) from public.crm_contacts where profile_id is not null") === profiles, `chaque profil a sa fiche contact (${profiles})`);
  ok(await count(db, "select count(*) from (select profile_id from public.crm_contacts where profile_id is not null group by profile_id having count(*) > 1) d") === 0, "…sans doublon");
  ok(await count(db, "select count(*) from public.crm_stages") === 6, "6 étapes de pipeline par défaut");

  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-a000-00000000c5aa', 'nouvelle@x.test', '{"first_name":"Nouvelle"}')`);
  ok(await count(db, "select count(*) from public.crm_contacts where profile_id = '00000000-0000-4000-a000-00000000c5aa'") === 1, "un nouveau compte reçoit aussitôt sa fiche (déclencheur)");

  console.log("  RLS : personne d'autre que les administratrices");
  ok(await as(JULIA, (tx) => count(tx, "select count(*) from public.crm_contacts")) > profiles, "Julia (admin) voit toutes les fiches");
  for (const [who, label] of [[INES, "Inès (membre)"], [KENZA, "Kenza (membre + partenaire)"], [RIM, "Rim (partenaire)"], [LOUBNA, "Loubna (membre + pro)"], [YASMINE, "Yasmine (modératrice)"]]) {
    const seen = await as(who, async (tx) => {
      let n = 0;
      for (const t of TABLES) n += await count(tx, `select count(*) from public.${t}`);
      return n;
    });
    ok(seen === 0, `${label} ne voit aucune donnée du CRM`);
  }
  ok(await as(null, async (tx) => {
    for (const t of TABLES) {
      try {
        await tx.query("savepoint s");
        if ((await count(tx, `select count(*) from public.${t}`)) > 0) return false;
      } catch {
        await tx.query("rollback to savepoint s");
      }
    }
    return true;
  }), "anonyme : aucune donnée du CRM");
  ok(await rejects(INES, "insert into public.crm_contacts (first_name, source, status) values ('Pirate', 'autre', 'prospect')"), "Inès ne crée pas de fiche");
  ok(await rejects(RIM, "insert into public.crm_tasks (title, due_on) values ('x', current_date)"), "Rim ne crée pas de tâche");
  ok(await rejects(INES, "insert into public.crm_segments (name) values ('x')"), "Inès ne crée pas de segment");
  ok(await as(INES, async (tx) => {
    await tx.query("update public.crm_contacts set notes = 'modifié' where id = $1", [ext]);
    await tx.query("delete from public.crm_activities");
    await tx.exec("reset role");
    return (await one(tx, "select notes from public.crm_contacts where id = $1", [ext])).notes !== "modifié" && (await count(tx, "select count(*) from public.crm_activities")) > 0;
  }), "Inès ne modifie ni ne supprime rien");
  ok(await rejects(INES, "select public.crm_merge_contacts($1, $2)", [ext, ext]), "Inès ne peut pas fusionner de fiches");

  console.log("  Gestion par les administratrices");
  ok(await as(JULIA, async (tx) => {
    const c = (await one(tx, "insert into public.crm_contacts (first_name, last_name, source, status, owner_id, tags) values ('Nouvelle', 'Fiche', 'evenement', 'prospect', $1, array['padel']) returning id", [NORA])).id;
    await tx.query("insert into public.crm_activities (contact_id, type, body, author_id) values ($1, 'whatsapp', 'Bonjour', $2)", [c, JULIA]);
    await tx.query("insert into public.crm_tasks (contact_id, title, due_on, owner_id, created_by) values ($1, 'Appeler', current_date + 1, $2, $3)", [c, NORA, JULIA]);
    await tx.query("update public.crm_contacts set marketing_consent = true where id = $1", [c]);
    return (await count(tx, "select count(*) from public.crm_tasks where contact_id = $1", [c])) === 1;
  }), "Julia crée une fiche, un échange et une tâche pour Nora");
  ok(await as(JULIA, async (tx) => {
    const ines = (await one(tx, "select id from public.crm_contacts where profile_id = $1", [INES])).id;
    const before = await count(tx, "select count(*) from public.crm_activities where contact_id = $1", [ines]);
    const dup = (await one(tx, "insert into public.crm_contacts (first_name, last_name, email, source, status, tags, notes) values ('Inès', 'Laurent', 'ines@exemple.com', 'instagram', 'prospect', array['doublon'], 'Fiche saisie à la main') returning id")).id;
    await tx.query("insert into public.crm_activities (contact_id, type, body) values ($1, 'note', 'Note sur le doublon')", [dup]);
    await tx.query("select public.crm_merge_contacts($1, $2)", [ines, dup]);
    const kept = await one(tx, "select profile_id, tags, source, notes from public.crm_contacts where id = $1", [ines]);
    const gone = await count(tx, "select count(*) from public.crm_contacts where id = $1", [dup]);
    const acts = await count(tx, "select count(*) from public.crm_activities where contact_id = $1", [ines]);
    return gone === 0 && kept.profile_id === INES && kept.tags.includes("doublon") && kept.source === "instagram" && kept.notes.includes("main") && acts === before + 2; // la note reprise + la trace de fusion
  }), "fusion d'un doublon : échanges repris, étiquettes et notes réunies, compte conservé");
  ok(await rejects(JULIA, "select public.crm_merge_contacts((select id from public.crm_contacts where profile_id = $1), (select id from public.crm_contacts where profile_id = $2))", [INES, KENZA]), "deux fiches reliées à deux comptes ne fusionnent pas");
  ok(await as(JULIA, async (tx) => {
    await tx.query("insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'crm.contact_merge', 'crm_contact', $2, 'Fusion')", [JULIA, ext]);
    await tx.query("insert into public.notifications (recipient_id, type, title, link) values ($1, 'crm_task_due', 'Tâche du jour', '/fondatrices/crm/taches')", [NORA]);
    return true;
  }), "journal (crm_contact) et notification (crm_task_due) acceptés");
  ok(await rejects(JULIA, "insert into public.audit_log (actor_id, action, target_type, summary) values ($1, 'crm.contact_merge', 'Pas Valide!', 'x')", [JULIA]), "…un type d'objet mal formé reste refusé");
  ok(await as(JULIA, async (tx) => {
    try {
      await tx.query("savepoint s");
      await tx.query("delete from public.crm_stages where id = $1", [stageNew]);
      return false;
    } catch {
      await tx.query("rollback to savepoint s");
      return true;
    }
  }), "une étape qui contient des opportunités ne peut pas être supprimée");

  // suppression d'un compte : la fiche reste, détachée
  await db.exec("delete from auth.users where id = '00000000-0000-4000-a000-00000000c5aa'");
  ok(await count(db, "select count(*) from public.crm_contacts where first_name = 'Nouvelle' and profile_id is null") >= 1, "un compte supprimé laisse sa fiche contact, détachée");
}
