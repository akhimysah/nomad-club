// Vague 2 · 2a — vérifications de la migration 0009_paiements.sql : échéanciers, échéances, grand livre,
// événements des prestataires (idempotence), clients, suspension de l'accès membre, RLS.
// Appelé par scripts/test-sql.mjs avec le banc PGlite déjà migré et rempli.

/** @param {{ db: import("@electric-sql/pglite").PGlite, as: Function, rejects: Function, one: Function, count: Function, ok: Function, uuid: (id: string) => string }} ctx */
export default async function paiements({ db, as, rejects, one, count, ok, uuid }) {
  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const LOU = uuid("p-lou");
  const RIM = uuid("p-rim");
  const KENZA = uuid("p-g11");
  const AMAJ = uuid("org-amaj");
  const BLOOM = uuid("org-bloom");

  console.log("\nPaiements (vague 2 · 0009)");

  // Données de test écrites « par le serveur » (propriétaire de la base = clé service).
  const planIdOf = async (profile) =>
    (await one(db, `insert into public.installment_plans (profile_id, plan, membership_action, installments_count, total_amount, provider, status)
                     values ($1, 'member', 'renew', 3, 670, 'stripe', 'active') returning id`, [profile])).id;
  const inesPlan = await planIdOf(INES);
  const louPlan = await planIdOf(LOU);
  for (const [plan, who] of [[inesPlan, INES], [louPlan, LOU]]) {
    await db.query(
      `insert into public.installments (plan_id, profile_id, seq, amount, due_date, status, paid_at) values
         ($1, $2, 1, 223.34, current_date - 40, 'paid', now()),
         ($1, $2, 2, 223.33, current_date - 10, 'failed', null),
         ($1, $2, 3, 223.33, current_date + 20, 'scheduled', null)`,
      [plan, who],
    );
  }
  await db.query(
    `insert into public.payment_transactions (provider, kind, profile_id, amount, description, provider_ref, related_type, related_id)
     values ('stripe', 'installment', $1, 223.34, 'Adhésion Membre · échéance 1/3', 'in_test_ines_1', 'installment_plan', $2),
            ('stripe', 'installment', $3, 223.34, 'Adhésion Membre · échéance 1/3', 'in_test_lou_1', 'installment_plan', $4)`,
    [INES, inesPlan, LOU, louPlan],
  );
  await db.query(
    `insert into public.payment_transactions (provider, kind, organization_id, amount, description, provider_ref)
     values ('stripe', 'pro_subscription', $1, 49, 'Carnet · Visibilité', 'in_test_amaj_1')`,
    [AMAJ],
  );
  await db.query(`insert into public.payment_events (provider, event_id, type, payload) values ('stripe', 'evt_test_1', 'invoice.paid', '{}'::jsonb)`);

  // --- schéma ---
  for (const t of ["payment_checkouts", "payment_events", "payment_customers", "installment_plans", "installments", "payment_transactions", "payment_refunds"]) {
    ok((await one(db, "select relrowsecurity as r from pg_class where relname = $1", [t])).r === true, `RLS active sur ${t}`);
  }
  ok(
    (await one(db, "select count(*)::int as n from information_schema.columns where table_name = 'pro_subscriptions' and column_name in ('provider', 'subscription_ref', 'customer_ref')")).n === 3,
    "pro_subscriptions : colonnes du prestataire ajoutées",
  );

  // --- idempotence ---
  let dup = false;
  try {
    await db.query(`insert into public.payment_events (provider, event_id, type, payload) values ('stripe', 'evt_test_1', 'invoice.paid', '{}'::jsonb)`);
  } catch {
    dup = true;
  }
  ok(dup, "un même événement Stripe ne peut être enregistré deux fois");
  ok(
    (await db.query(`insert into public.payment_events (provider, event_id, type, payload) values ('stripe', 'evt_test_1', 'invoice.paid', '{}'::jsonb) on conflict do nothing returning id`)).rows.length === 0,
    "…et « on conflict do nothing » ne renvoie rien (doublon ignoré)",
  );
  let dupTx = false;
  try {
    await db.query(`insert into public.payment_transactions (provider, kind, profile_id, amount, description, provider_ref) values ('stripe', 'installment', $1, 1, 'x', 'in_test_ines_1')`, [INES]);
  } catch {
    dupTx = true;
  }
  ok(dupTx, "une facture ne crée qu'une écriture au grand livre (provider + référence uniques)");
  let dupSeq = false;
  try {
    await db.query(`insert into public.installments (plan_id, profile_id, seq, amount, due_date) values ($1, $2, 1, 1, current_date)`, [inesPlan, INES]);
  } catch {
    dupSeq = true;
  }
  ok(dupSeq, "une seule échéance par rang dans un échéancier");
  const rn = await one(db, "select receipt_number from public.payment_transactions where provider_ref = 'in_test_ines_1'");
  ok(/^NC-\d{4}-\d{6}$/.test(rn.receipt_number), `numéro de reçu attribué (${rn.receipt_number})`);
  let overRefund = false;
  try {
    await db.query("update public.payment_transactions set amount_refunded = amount + 1 where provider_ref = 'in_test_ines_1'");
  } catch {
    overRefund = true;
  }
  ok(overRefund, "on ne rembourse pas plus que le montant encaissé");

  // --- RLS : échéanciers et échéances ---
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.installments"))) === 3, "Inès voit ses 3 échéances");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.installments where profile_id <> $1", [INES]))) === 0, "…et aucune échéance d'une autre membre");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.installment_plans"))) === 1, "Inès ne voit que son échéancier");
  ok((await as(LOU, (tx) => count(tx, "select count(*) from public.installment_plans where profile_id = $1", [INES]))) === 0, "Lou ne voit pas l'échéancier d'Inès");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.installments"))) >= 6, "l'admin voit toutes les échéances");
  ok((await as(INES, (tx) => count(tx, "with u as (update public.installments set status = 'paid', paid_at = now() where profile_id = $1 returning 1) select count(*) from u", [INES]))) === 0, "Inès ne peut pas marquer elle-même une échéance payée");
  ok(
    await rejects(INES, "insert into public.installments (plan_id, profile_id, seq, amount, due_date) values ($1, $2, 9, 0, current_date)", [inesPlan, INES]),
    "Inès ne peut pas créer d'échéance",
  );
  ok(
    await rejects(INES, "insert into public.installment_plans (profile_id, plan, membership_action, installments_count, total_amount, provider) values ($1, 'premium', 'join', 1, 0, 'simulated')", [INES]),
    "Inès ne peut pas créer d'échéancier",
  );
  ok(await rejects(null, "select * from public.installments"), "anonyme : échéances interdites");

  // --- RLS : grand livre ---
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.payment_transactions"))) === 1, "Inès ne voit que ses encaissements");
  ok((await as(RIM, (tx) => count(tx, "select count(*) from public.payment_transactions where organization_id = $1", [AMAJ]))) === 1, "Rim (Maison Amaj) voit les encaissements de son établissement");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.payment_transactions where organization_id = $1", [AMAJ]))) === 0, "Kenza (Bloom House) ne voit pas ceux de Maison Amaj");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.payment_transactions"))) >= 3, "l'admin voit tout le grand livre");
  ok(await rejects(INES, "insert into public.payment_transactions (provider, kind, profile_id, amount, description) values ('simulated', 'shop', $1, 0, 'x')", [INES]), "Inès ne peut pas écrire au grand livre");
  ok(await rejects(null, "select * from public.payment_transactions"), "anonyme : grand livre interdit");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.payment_revenue_by_month"))) >= 1, "vue des encaissements : Inès n'y voit que ses lignes (RLS appliquée)");
  ok(await rejects(null, "select * from public.payment_revenue_by_month"), "anonyme : vue des encaissements interdite");

  // --- RLS : événements bruts, clients, remboursements ---
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.payment_events"))) === 0, "une membre ne voit aucun événement de prestataire");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.payment_events"))) >= 1, "l'admin voit les événements (pour les rejouer)");
  ok(await rejects(JULIA, "insert into public.payment_events (provider, event_id, type, payload) values ('stripe', 'evt_forge', 'x', '{}')"), "même l'admin n'écrit pas d'événement (serveur seulement)");
  await db.query("insert into public.payment_customers (provider, customer_ref, profile_id) values ('stripe', 'cus_ines', $1)", [INES]);
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.payment_customers"))) === 0, "les références client Stripe ne sont pas exposées aux membres");
  let twoOwners = false;
  try {
    await db.query("insert into public.payment_customers (provider, customer_ref, profile_id, organization_id) values ('stripe', 'cus_x', $1, $2)", [INES, BLOOM]);
  } catch {
    twoOwners = true;
  }
  ok(twoOwners, "un client appartient soit à une personne, soit à un établissement");
  const txId = (await one(db, "select id from public.payment_transactions where provider_ref = 'in_test_ines_1'")).id;
  await db.query("insert into public.payment_refunds (transaction_id, amount, reason, provider_ref, created_by) values ($1, 20, 'geste', 're_test_1', $2)", [txId, JULIA]);
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.payment_refunds"))) === 1, "Inès voit le remboursement de son paiement");
  ok((await as(LOU, (tx) => count(tx, "select count(*) from public.payment_refunds"))) === 0, "Lou ne le voit pas");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.payment_checkouts where profile_id <> $1", [INES]))) === 0, "sessions de paiement : chacune les siennes");

  // --- suspension / rétablissement de l'accès membre ---
  ok(await rejects(INES, "select public.pay_set_member_access($1, false)", [INES]), "pay_set_member_access est réservée au serveur");
  await db.query("select public.pay_set_member_access($1, false)", [LOU]);
  ok((await one(db, "select count(*)::int as n from public.user_roles where profile_id = $1 and role = 'member'", [LOU])).n === 0, "impayé au-delà du délai de grâce : Lou perd l'accès membre");
  ok((await as(LOU, (tx) => count(tx, "select count(*) from public.profiles"))) <= 1, "…et ne voit plus l'annuaire");
  ok((await as(LOU, (tx) => count(tx, "select count(*) from public.installments"))) === 3, "…mais voit toujours ses échéances pour régulariser");
  await db.query("select public.pay_set_member_access($1, true)", [LOU]);
  ok((await one(db, "select count(*)::int as n from public.user_roles where profile_id = $1 and role = 'member'", [LOU])).n === 1, "régularisation : l'accès membre est rendu");
  ok((await one(db, "select public.pay_set_member_access($1, false) as v", [JULIA])).v === false, "une administratrice n'est jamais suspendue");
  ok((await one(db, "select count(*)::int as n from public.user_roles where profile_id = $1 and role = 'admin'", [JULIA])).n === 1, "…et garde son rôle");

  // nettoyage (le banc est partagé avec les autres modules)
  await db.exec("delete from public.payment_refunds; delete from public.payment_transactions; delete from public.installment_plans; delete from public.payment_events; delete from public.payment_customers;");
}
