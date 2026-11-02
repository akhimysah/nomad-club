// Lot 3 — vérifications de 0005_partenaires.sql (appelé par scripts/test-sql.mjs).
// Statistiques et codes cloisonnés par établissement, fonctions claim / validate, abonnements des pros,
// positions approximatives et consentement, invitations d'équipe.
export default async function partenairesTests({ db, as, rejects, one, count, ok, uuid }) {
  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const KENZA = uuid("p-g11");
  const STAFF = uuid("p-g20");
  const LOUBNA = uuid("p-g34");
  const RIM = uuid("p-rim");
  const YASMINE = uuid("p-yasmine");
  const BLOOM = uuid("org-bloom");
  const AMAJ = uuid("org-amaj");
  const CHERKAOUI = uuid("org-cherkaoui");
  const IDRISSI = uuid("org-idrissi");
  const LINA = uuid("org-lina");
  const ALAOUI = uuid("org-alaoui");
  const OFF_BLOOM = uuid("off-bloom");
  const OFF_BLOOM_PREMIUM = uuid("off-bloom-2");
  const OFF_AMAJ = uuid("off-amaj");
  const OFF_PAUSED = uuid("off-terre-ete");

  /** Change la personne connectée au milieu d'une transaction. */
  const switchTo = (tx, id) => tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);

  console.log("\nLot 3 · statistiques et codes cloisonnés");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.org_stats_monthly where organization_id = $1", [BLOOM]))) >= 6, "Kenza voit les statistiques de Bloom House (6 mois)");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.org_stats_monthly where organization_id <> $1", [BLOOM]))) === 0, "…et aucune statistique d'un autre établissement");
  ok((await as(RIM, (tx) => count(tx, "select count(*) from public.org_stats_monthly where organization_id <> $1", [AMAJ]))) === 0, "Rim ne voit que les statistiques de Maison Amaj");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.org_stats_monthly"))) === 0, "une membre ne voit aucune statistique");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.offer_codes where organization_id <> $1 and profile_id <> $2", [BLOOM, KENZA]))) === 0, "Kenza ne voit que les codes de ses offres (et les siens comme membre)");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.offer_code_stats where organization_id = $1", [BLOOM]))) > 0, "la vue offer_code_stats donne les codes par mois à Kenza");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.offer_codes where profile_id <> $1", [INES]))) === 0, "Inès ne voit que ses propres codes");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.offer_codes"))) > 100, "l'administratrice voit tous les codes");
  ok(await rejects(KENZA, "insert into public.org_stats_monthly (organization_id, month, views) values ($1, '2026-10-01', 999)", [BLOOM]), "Kenza ne gonfle pas ses statistiques à la main");
  ok(await rejects(KENZA, "insert into public.offer_codes (offer_id, organization_id, profile_id, code) values ($1, $2, $3, 'OF-AAAA-BBBB')", [OFF_BLOOM, BLOOM, INES]), "personne n'écrit un code directement");

  console.log("\nLot 3 · offres et utilisation");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.partner_offers where id = $1", [OFF_PAUSED]))) === 0, "une offre en pause est invisible pour les membres");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.partner_offers where status = 'active'"))) >= 7, "les membres voient les offres actives");
  ok((await as(INES, async (tx) => {
    const a = (await one(tx, "select (public.claim_offer_code($1)).code as c", [OFF_AMAJ])).c;
    const b = (await one(tx, "select (public.claim_offer_code($1)).code as c", [OFF_AMAJ])).c;
    return /^OF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(a) && a === b;
  })) === true, "« Utiliser l'offre » : Inès obtient un code personnel, le même tant qu'il n'est pas validé");
  ok(await rejects(INES, "select public.claim_offer_code($1)", [OFF_BLOOM_PREMIUM]), "une offre Premium est refusée à une membre Membre");
  ok(await rejects(INES, "select public.claim_offer_code($1)", [OFF_PAUSED]), "une offre en pause ne donne pas de code");
  ok(await rejects(RIM, "select public.claim_offer_code($1)", [OFF_BLOOM]), "une partenaire hors cercle n'obtient pas de code");
  ok((await as(YASMINE, async (tx) => !!(await one(tx, "select (public.claim_offer_code($1)).code as c", [OFF_BLOOM_PREMIUM])).c)) === true, "Yasmine (Premium) obtient le code de l'offre Premium");
  ok((await as(INES, async (tx) => {
    const code = (await one(tx, "select (public.claim_offer_code($1)).code as c", [OFF_BLOOM])).c;
    await switchTo(tx, KENZA);
    const r = (await one(tx, "select public.validate_offer_code($1) as r", [code.toLowerCase()])).r;
    let twice = false;
    try {
      await tx.query("savepoint s");
      await tx.query("select public.validate_offer_code($1)", [code]);
    } catch {
      twice = true;
      await tx.query("rollback to savepoint s");
    }
    await switchTo(tx, INES);
    const again = (await one(tx, "select (public.claim_offer_code($1)).code as c", [OFF_BLOOM])).c;
    return r.first_name === "Inès" && !!r.validated_at && twice && again !== code;
  })) === true, "Kenza valide le code d'Inès (une seule fois) ; Inès peut ensuite en obtenir un nouveau");
  ok((await as(INES, async (tx) => {
    const code = (await one(tx, "select (public.claim_offer_code($1)).code as c", [OFF_AMAJ])).c;
    await switchTo(tx, KENZA);
    try {
      await tx.query("savepoint s");
      await tx.query("select public.validate_offer_code($1)", [code]);
      return false;
    } catch {
      await tx.query("rollback to savepoint s");
      return true;
    }
  })) === true, "Kenza ne valide pas un code de Maison Amaj");
  ok((await as(KENZA, async (tx) => {
    await tx.query("insert into public.partner_offers (badge, partner, detail, title, organization_id) values ('-5 %', 'Bloom House', 'Test', 'Test', $1)", [BLOOM]);
    await tx.query("update public.partner_offers set status = 'paused' where id = $1", [OFF_BLOOM]);
    return count(tx, "select count(*) from public.partner_offers where organization_id = $1 and status = 'paused'", [BLOOM]);
  })) === 1, "Kenza crée une offre et met la sienne en pause");
  ok(await rejects(KENZA, "insert into public.partner_offers (badge, partner, detail, organization_id) values ('x', 'x', 'x', $1)", [AMAJ]), "…mais pas pour Maison Amaj");

  console.log("\nLot 3 · statistiques de visite");
  ok((await as(INES, async (tx) => {
    const m = "date_trunc('month', now() at time zone 'Africa/Casablanca')::date";
    await tx.exec("reset role");
    const before = Number((await one(tx, `select coalesce((select views from public.org_stats_monthly where organization_id = $1 and month = ${m}), 0) as v`, [BLOOM])).v);
    await tx.exec("set local role authenticated");
    await tx.query("select public.track_org_event($1, 'view')", [BLOOM]);
    await tx.query("select public.track_org_event($1, 'whatsapp')", [BLOOM]);
    await switchTo(tx, KENZA);
    await tx.query("select public.track_org_event($1, 'view')", [BLOOM]); // l'établissement ne se compte pas
    await tx.exec("reset role");
    const r = await one(tx, `select views, whatsapp_clicks from public.org_stats_monthly where organization_id = $1 and month = ${m}`, [BLOOM]);
    return Number(r.views) === before + 1 && Number(r.whatsapp_clicks) >= 1;
  })) === true, "une vue d'Inès est comptée, pas celle de Kenza sur sa propre fiche");

  console.log("\nLot 3 · abonnements des pros");
  // dates relatives au jour du test (la base d'exemple est datée d'octobre 2026)
  await db.query("update public.pro_subscriptions set current_period_end = current_date + 10 where status = 'active'");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.pro_subscriptions where organization_id in ($1, $2)", [CHERKAOUI, IDRISSI]))) === 2, "une membre voit les abonnements actifs (fiches visibles)");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.pro_subscriptions where organization_id in ($1, $2)", [LINA, ALAOUI]))) === 0, "…pas ceux en retard ou suspendus (fiches masquées)");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.pro_subscription_payments"))) === 0, "une membre ne voit aucun paiement d'abonnement");
  ok((await as(LOUBNA, (tx) => count(tx, "select count(*) from public.pro_subscription_payments where organization_id <> $1", [CHERKAOUI]))) === 0, "Loubna ne voit que les paiements de son cabinet");
  ok((await as(LOUBNA, (tx) => count(tx, "select count(*) from public.pro_subscription_payments where organization_id = $1", [CHERKAOUI]))) > 0, "…et elle les voit");
  ok((await as(LOUBNA, async (tx) => {
    await tx.query("update public.pro_subscriptions set current_period_end = '2030-01-01' where organization_id = $1", [CHERKAOUI]);
    return (await one(tx, "select current_period_end::text as d from public.pro_subscriptions where organization_id = $1", [CHERKAOUI])).d;
  })) !== "2030-01-01", "Loubna ne prolonge pas son abonnement sans payer");
  ok(await rejects(LOUBNA, "insert into public.pro_subscription_payments (organization_id, plan, amount, status, reference, period_start, period_end) values ($1, 'vitrine', 0, 'paid', 'x', current_date, current_date + 30)", [CHERKAOUI]), "Loubna n'enregistre pas de paiement elle-même");
  ok(await rejects(LOUBNA, "select public.refresh_pro_subscriptions()"), "refresh_pro_subscriptions() est réservée au serveur");
  ok(await db.transaction(async (tx) => {
    await tx.query("update public.pro_subscriptions set current_period_end = current_date - 3 where organization_id = $1", [CHERKAOUI]);
    await tx.query("update public.pro_subscriptions set current_period_end = current_date - 20, status = 'active' where organization_id = $1", [IDRISSI]);
    await tx.query("select public.refresh_pro_subscriptions()");
    const a = (await one(tx, "select status from public.pro_subscriptions where organization_id = $1", [CHERKAOUI])).status;
    const b = (await one(tx, "select status from public.pro_subscriptions where organization_id = $1", [IDRISSI])).status;
    await tx.rollback();
    return a === "past_due" && b === "suspended";
  }), "échéance dépassée : en retard, puis suspendu après 15 jours");

  console.log("\nLot 3 · carte : consentement et position approximative");
  const shared = await as(INES, (tx) => count(tx, "select count(*) from public.member_locations"));
  ok(shared >= 7, `Inès voit les ${shared} positions partagées`);
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.member_locations where profile_id = $1", [KENZA]))) === 0, "…pas celle de Kenza, qui n'a pas consenti");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.member_locations where profile_id = $1", [KENZA]))) === 0, "même l'administratrice ne voit pas une position non partagée");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.member_locations where profile_id = $1", [KENZA]))) === 1, "Kenza voit sa propre ligne");
  ok((await as(RIM, (tx) => count(tx, "select count(*) from public.member_locations"))) === 0, "une partenaire hors cercle ne voit aucune position");
  ok((await as(INES, async (tx) => {
    await tx.query("insert into public.member_locations (profile_id, sharing, precision, area, lat, lng) values ($1, true, 'approx', 'Guéliz', 31.63456, -8.01234)", [INES]);
    const r = await one(tx, "select lat, lng, consented_at from public.member_locations where profile_id = $1", [INES]);
    return Math.abs(r.lat - 31.635) < 1e-9 && Math.abs(r.lng + 8.01) < 1e-9 && !!r.consented_at;
  })) === true, "la position enregistrée est arrondie (~500 m), jamais exacte");
  ok((await as(INES, async (tx) => {
    await tx.query("insert into public.member_locations (profile_id, sharing, precision, area, lat, lng) values ($1, true, 'approx', 'Guéliz', 31.63456, -8.01234)", [INES]);
    await tx.query("update public.member_locations set sharing = false where profile_id = $1", [INES]);
    const r = await one(tx, "select lat, lng, area, consented_at from public.member_locations where profile_id = $1", [INES]);
    await switchTo(tx, YASMINE);
    const seen = await count(tx, "select count(*) from public.member_locations where profile_id = $1", [INES]);
    return r.lat === null && r.lng === null && r.area === null && r.consented_at === null && seen === 0;
  })) === true, "désactiver le partage efface la position et la retire de la carte");
  ok(await rejects(INES, "insert into public.member_locations (profile_id, sharing, lat, lng) values ($1, true, 31.6, -8.0)", [YASMINE]), "Inès ne crée pas la position d'une autre membre");

  console.log("\nLot 3 · fiche et équipe");
  ok((await as(STAFF, async (tx) => {
    await tx.query("update public.organizations set description = 'Par la collaboratrice' where id = $1", [BLOOM]);
    await tx.query("update public.establishment_details set hours = 'Tous les jours' where organization_id = $1", [BLOOM]);
    const a = (await one(tx, "select description from public.organizations where id = $1", [BLOOM])).description;
    const b = (await one(tx, "select hours from public.establishment_details where organization_id = $1", [BLOOM])).hours;
    return a === "Par la collaboratrice" && b === "Tous les jours";
  })) === true, "une collaboratrice de Bloom House modifie la fiche");
  ok((await as(KENZA, async (tx) => {
    await tx.query("update public.establishment_details set hours = 'x' where organization_id = $1", [AMAJ]);
    return (await one(tx, "select hours from public.establishment_details where organization_id = $1", [AMAJ]))?.hours !== "x";
  })) === true, "Kenza ne touche pas à la fiche de Maison Amaj");
  ok((await as(KENZA, async (tx) => {
    const id = (await one(tx, "select public.invite_org_member($1, 'LOUBNA@exemple.com') as id", [BLOOM])).id;
    await tx.exec("reset role");
    const roles = (await one(tx, "select array_agg(role order by role) as r from public.user_roles where profile_id = $1", [LOUBNA])).r.join();
    const member = await count(tx, "select count(*) from public.organization_members where organization_id = $1 and profile_id = $2 and role = 'staff'", [BLOOM, LOUBNA]);
    return id === LOUBNA && member === 1 && roles.includes("partner");
  })) === true, "Kenza invite Loubna (compte existant) : elle rejoint l'équipe et l'espace partenaire");
  ok((await as(KENZA, async (tx) => {
    const id = (await one(tx, "select public.invite_org_member($1, 'nouvelle@exemple.com') as id", [BLOOM])).id;
    await tx.exec("reset role");
    await tx.query("insert into auth.users (id, email) values ('00000000-0000-4000-a000-0000000000aa', 'nouvelle@exemple.com')");
    const joined = await count(tx, "select count(*) from public.organization_members where organization_id = $1 and profile_id = '00000000-0000-4000-a000-0000000000aa'", [BLOOM]);
    return id === null && joined === 1;
  })) === true, "une invitation sans compte attend, puis s'applique à la création du compte");
  ok(await rejects(STAFF, "select public.invite_org_member($1, 'x@exemple.com')", [BLOOM]), "une collaboratrice n'invite pas (propriétaire seulement)");
  ok(await rejects(INES, "select public.invite_org_member($1, 'x@exemple.com')", [BLOOM]), "une membre n'invite pas dans un établissement");
  ok((await as(KENZA, async (tx) => {
    await tx.query("insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'offer.create', 'organization', $2, 'Offre créée')", [KENZA, BLOOM]);
    return true;
  })) === true, "Kenza journalise une opération sur son établissement");
  ok(await rejects(KENZA, "insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'offer.create', 'organization', $2, 'x')", [KENZA, AMAJ]), "…pas sur un autre établissement");
}
