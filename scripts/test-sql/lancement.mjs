// Vague 2 — chantier « Inscription et lancement » : vérifications de 0012_lancement.sql
// (inscription depuis les métadonnées, onboarding, CGU, candidatures, invitations à usage unique).
// Appelé par scripts/test-sql.mjs avec le banc PGlite déjà migré et rempli.

export default async function lancement({ db, as, rejects, one, count, ok, uuid }) {
  console.log("\nInscription et lancement (0012)");
  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const NEW = "11111111-2222-4333-a444-555555555555";
  const OTHER = "11111111-2222-4333-a444-666666666666";
  const BLOOM = uuid("org-bloom");

  // Inscription : le déclencheur lit les métadonnées (nettoyées), crée profil, onboarding et fiche CRM.
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'camille@exemple.com', $2::jsonb),
       ($3, 'zoe@exemple.com', '{"first_name":"Zoé","role":"admin","signup_path":"apply","heard_from":"pirate"}'::jsonb)`,
    [
      NEW,
      JSON.stringify({ first_name: "  Camille ", last_name: "Durand", whatsapp: "+212 6<script>00 00 00 01", country: "Française", heard_from: "instagram", signup_path: "apply", referral_code: "ines-27", terms_accepted: "true" }),
      OTHER,
    ],
  );
  const p = await one(db, "select first_name, last_name, whatsapp, country from public.profiles where id = $1", [NEW]);
  ok(p.first_name === "Camille" && p.last_name === "Durand" && p.country === "Française", "inscription : prénom, nom et pays repris des métadonnées");
  ok(p.whatsapp === "+212 600 00 00 01", "inscription : WhatsApp nettoyé (chiffres, + et espaces seulement)");
  const o = await one(db, "select * from public.member_onboarding where profile_id = $1", [NEW]);
  ok(o.heard_from === "instagram" && o.signup_path === "apply" && o.referral_code === "INES-27", "inscription : source, parcours choisi et code de parrainage");
  ok(!!o.terms_accepted_at && o.terms_version === "2026-11-brouillon", "inscription : CGU acceptées, version horodatée");
  ok(!o.completed_at, "inscription : onboarding à faire");
  ok((await one(db, "select source from public.crm_contacts where profile_id = $1", [NEW])).source === "instagram", "CRM : la fiche reprend la source déclarée");
  const z = await one(db, "select heard_from, terms_accepted_at from public.member_onboarding where profile_id = $1", [OTHER]);
  ok(z.heard_from === null && z.terms_accepted_at === null, "inscription : valeur inconnue ignorée, pas de CGU sans case cochée");
  ok((await count(db, "select count(*) from public.user_roles where profile_id = $1", [OTHER])) === 0, "inscription : les métadonnées ne donnent aucun rôle");
  ok(
    await as(INES, async (tx) => {
      await tx.query("set local role postgres");
      await tx.query("delete from public.member_onboarding where profile_id = $1", [INES]);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [INES]);
      await tx.query("set local role authenticated");
      return !!(await one(tx, "select (public.my_onboarding()).profile_id as p")).p;
    }),
    "compte sans ligne d'onboarding (créé hors inscription) : ligne créée à la demande",
  );

  // Onboarding et CGU
  ok(await as(NEW, async (tx) => (await one(tx, "select (public.onboarding_progress('profile')).steps_done as s")).s.join() === "profile"), "onboarding : étape faite");
  ok(await as(NEW, async (tx) => !!(await one(tx, "select (public.onboarding_progress(null, 'skipped')).skipped_at as s")).s), "onboarding : sauter pour plus tard");
  ok(await rejects(NEW, "select public.onboarding_progress('pirate')"), "onboarding : étape inconnue refusée");
  ok(await as(OTHER, async (tx) => !!(await one(tx, "select (public.accept_terms('203.0.113.7')).terms_accepted_at as t")).t), "CGU : acceptées plus tard (IP gardée, journalisé)");
  ok(await rejects(NEW, "update public.member_onboarding set completed_at = now() where profile_id = auth.uid()"), "onboarding : pas d'écriture directe");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.member_onboarding where profile_id = $1", [NEW])) === 0, "onboarding : invisible des autres membres");
  ok(await rejects(null, "select public.my_onboarding()"), "onboarding : anonyme refusée");

  // Réglage : adhésion sur validation (par défaut) ou directe
  ok(await as(null, async (tx) => (await one(tx, "select membership_mode from public.lancement_settings")).membership_mode === "validation"), "réglages : lisibles sans compte, adhésion sur validation par défaut");
  ok(await rejects(INES, "update public.lancement_settings set membership_mode = 'direct'") || (await as(INES, (tx) => tx.query("update public.lancement_settings set membership_mode = 'direct' returning id")))?.rows.length === 0, "réglages : une membre ne les modifie pas");
  ok((await as(JULIA, (tx) => tx.query("update public.lancement_settings set membership_mode = 'direct' returning id")))?.rows.length === 1, "réglages : l'admin les modifie");
  ok(await as(NEW, async (tx) => !(await one(tx, "select public.can_join_membership() as v")).v), "validation : pas de paiement d'adhésion sans candidature acceptée");
  ok(await as(INES, async (tx) => (await one(tx, "select public.can_join_membership() as v")).v), "validation : une membre (renouvellement) peut payer");

  // Candidatures
  const appId = await as(NEW, async (tx) => {
    const r = await one(tx, "select (public.submit_membership_application('Architecte', 'Atelier C', '2024', 'J’aimerais rencontrer d’autres entrepreneuses.')).id as id");
    return r.id;
  });
  ok(!!appId, "candidature : déposée");
  // la candidature a été annulée par le rollback du banc : on la recrée hors transaction
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)", [NEW]);
  const app = (await db.query("select (public.submit_membership_application('Architecte', 'Atelier C', '2024', 'J’aimerais rencontrer d’autres entrepreneuses.')).id as id")).rows[0].id;
  await db.query("select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)");
  ok((await count(db, "select count(*) from public.notifications where type = 'application_received'")) >= 2, "candidature : les admins sont notifiées");
  ok((await count(db, "select count(*) from public.audit_log where action = 'application.submit' and target_id = $1", [app])) === 1, "candidature : journalisée");
  ok((await count(db, "select count(*) from public.crm_activities a join public.crm_contacts c on c.id = a.contact_id where c.profile_id = $1", [NEW])) >= 1, "candidature : notée sur la fiche CRM");
  ok(await rejects(NEW, "select public.submit_membership_application('Architecte', null, '2024', 'Une deuxième candidature trop vite.')"), "candidature : une seule en attente");
  ok(await rejects(INES, "select public.submit_membership_application('Consultante', null, '2025', 'Je suis déjà membre du club, donc refusé.')"), "candidature : refusée pour une membre active");
  ok(await rejects(NEW, "select public.submit_membership_application('A', null, '2024', 'court')"), "candidature : champs trop courts refusés");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.membership_applications where profile_id = $1", [NEW])) === 0, "candidature : invisible des autres membres");
  ok(await as(JULIA, (tx) => count(tx, "select count(*) from public.membership_applications where status = 'pending'")) >= 1, "candidature : visible des admins");
  ok(await rejects(INES, "select public.decide_membership_application($1, true)", [app]), "décision : réservée aux admins");
  ok(await rejects(JULIA, "select public.decide_membership_application($1, false, '')", [app]), "décision : refus sans message impossible");
  const accepted = await as(JULIA, async (tx) => {
    await tx.query("update public.lancement_settings set membership_mode = 'validation'");
    const r = await one(tx, "select (public.decide_membership_application($1, true, 'Ravies de t’accueillir !')).status as s", [app]);
    await tx.query("set local role postgres"); // la RLS cache à l'admin les notifications des autres
    const n = await count(tx, "select count(*) from public.notifications where recipient_id = $1 and type = 'application_accepted'", [NEW]);
    const a = await count(tx, "select count(*) from public.audit_log where action = 'application.accept'");
    return r.s === "accepted" && n === 1 && a === 1;
  });
  ok(accepted, "décision : acceptée, notifiée, journalisée");
  await db.query("update public.membership_applications set status = 'accepted', decided_at = now() where id = $1", [app]);
  ok(await as(NEW, async (tx) => (await one(tx, "select public.can_join_membership() as v")).v), "validation : candidature acceptée → paiement possible");
  ok(await rejects(JULIA, "select public.decide_membership_application($1, false, 'Non')", [app]), "décision : une seule fois");
  await db.query("update public.lancement_settings set membership_mode = 'validation'");

  // Invitations à usage unique
  const inv = await as(JULIA, async (tx) => (await one(tx, "select public.create_role_invitation('Zoe@Exemple.com', 'partner', $1, 'Bienvenue') as j", [BLOOM])).j);
  ok(!!inv?.token && inv.token.length === 48, "invitation : jeton aléatoire renvoyé une fois");
  ok(await rejects(INES, "select public.create_role_invitation('x@exemple.com', 'moderator')"), "invitation : réservée aux admins");
  ok(await rejects(JULIA, "select public.create_role_invitation('x@exemple.com', 'admin')"), "invitation : pas de rôle admin par lien");
  // recréée hors transaction pour la suite
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)", [JULIA]);
  const token = (await db.query("select public.create_role_invitation('zoe@exemple.com', 'partner', $1) as j", [BLOOM])).rows[0].j.token;
  await db.query("select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)");
  ok((await count(db, "select count(*) from public.role_invitations where token_hash = $1", [token])) === 0, "invitation : seule l'empreinte du jeton est stockée");
  const prev = await as(null, async (tx) => (await one(tx, "select public.role_invitation_preview($1) as j", [token])).j);
  ok(prev?.state === "open" && prev.role === "partner" && prev.email_hint.startsWith("zo•••@") && prev.organization, "invitation : aperçu sans compte (adresse masquée)");
  ok(await as(null, async (tx) => (await one(tx, "select public.role_invitation_preview('faux') as j")).j === null), "invitation : jeton inconnu → rien");
  ok(await rejects(NEW, "select public.accept_role_invitation($1)", [token]), "invitation : refusée avec une autre adresse");
  ok(await rejects(OTHER, "select public.accept_role_invitation('faux')"), "invitation : jeton inconnu refusé");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.role_invitations")) === 0, "invitation : invisible des membres");
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)", [OTHER]);
  const acc = (await db.query("select public.accept_role_invitation($1) as j", [token])).rows[0].j;
  await db.query("select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)");
  ok(acc.role === "partner", "invitation : acceptée par la bonne personne");
  ok((await count(db, "select count(*) from public.user_roles where profile_id = $1 and role = 'partner'", [OTHER])) === 1, "invitation : rôle partenaire attribué");
  ok((await count(db, "select count(*) from public.organization_members where profile_id = $1 and organization_id = $2", [OTHER, BLOOM])) === 1, "invitation : rattachée à l'établissement");
  ok((await count(db, "select count(*) from public.audit_log where action = 'invitation.accept'")) === 1, "invitation : acceptation journalisée");
  ok(await rejects(OTHER, "select public.accept_role_invitation($1)", [token]), "invitation : usage unique");
  ok(await as(null, async (tx) => (await one(tx, "select public.role_invitation_preview($1) as j", [token])).j.state === "used"), "invitation : aperçu « déjà utilisée »");
  const expired = await as(JULIA, async (tx) => {
    const t = (await one(tx, "select public.create_role_invitation('late@exemple.com', 'pro') as j")).j.token;
    await tx.query("set local role postgres");
    await tx.query("update public.role_invitations set expires_at = now() - interval '1 day' where email = 'late@exemple.com'");
    return (await one(tx, "select public.role_invitation_preview($1) as j", [t])).j.state;
  });
  ok(expired === "expired", "invitation : expirée après 14 jours");
}
