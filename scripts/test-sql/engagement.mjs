// Lot 4 (engagement) : vérifications de 0006_engagement.sql (RLS, fonctions, déclencheurs).
// Appelé par scripts/test-sql.mjs avec ses aides (as, rejects, ok…).
import { join } from "node:path";
import { engagementSeedLines } from "../seed-sql/engagement.mjs";

export default async function run({ db, root, as, rejects, one, count, ok, uuid }) {
  // Données d'exemple du lot (si supabase/seed.sql n'a pas encore été régénéré avec elles).
  if (!(await one(db, "select count(*)::int as n from public.products")).n) {
    const { createSeed } = await import(join(root, "src/lib/seed.ts"));
    await db.exec(["begin;", "select set_config('nc.trusted', 'on', true);", ...engagementSeedLines(createSeed(), uuid), "commit;"].join("\n"));
  }

  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const SALMA = uuid("p-salma");
  const YASMINE = uuid("p-yasmine");
  const HANA = uuid("p-hana");
  const P = (id) => uuid(id);
  const D = (id) => uuid(id);

  /** Comme `as`, mais avec une préparation en superutilisatrice avant de prendre l'identité. */
  async function asAfter(setupSql, userId, fn) {
    try {
      return await db.transaction(async (tx) => {
        await tx.exec(setupSql);
        await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [userId]);
        await tx.exec("set local role authenticated");
        const out = await fn(tx);
        await tx.rollback();
        return out;
      });
    } catch (e) {
      return `erreur : ${e.message}`;
    }
  }

  console.log("\nEngagement · boutique");
  ok(await rejects(null, "select * from public.products"), "anonyme : boutique interdite");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.products"))) === 5, "Inès voit les 5 ressources publiées (pas le brouillon)");
  ok((await as(HANA, (tx) => count(tx, "select count(*) from public.products"))) === 0, "Hana (compte gratuit) ne voit pas la boutique");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.purchases"))) === 2, "Inès ne voit que ses 2 achats");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.purchases"))) === 20, "Julia (admin) voit toutes les ventes");
  ok(
    (await as(INES, (tx) => count(tx, "select count(*) from public.product_files where product_id in ($1, $2)", [P("pr-installer"), P("pr-carnet")]))) === 4,
    "Inès voit tous les fichiers de ce qu'elle a acheté",
  );
  ok(
    (await as(INES, (tx) => count(tx, "select count(*) from public.product_files where product_id = $1", [P("pr-societe")]))) === 1,
    "…seulement l'extrait gratuit de ce qu'elle n'a pas acheté",
  );
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.product_files where id = $1", [uuid("pf-modeles")]))) === 0, "…et aucun fichier payant non acheté");
  ok(await rejects(INES, "insert into public.purchases (product_id, profile_id, amount, method) values ($1, $2, 0, 'simulated')", [P("pr-modeles"), INES]), "Inès ne peut pas s'offrir un achat sans payer");
  ok(
    await as(INES, async (tx) => {
      const r = await one(tx, "select * from public.purchase_product_simulated($1)", [P("pr-modeles")]);
      const files = await count(tx, "select count(*) from public.product_files where id = $1", [uuid("pf-modeles")]);
      return r.status === "paid" && Number(r.amount) === 19 && files === 1;
    }),
    "achat simulé : prix membre appliqué, fichier accessible tout de suite",
  );
  ok(
    await as(INES, async (tx) => {
      const a = await one(tx, "select id from public.purchase_product_simulated($1)", [P("pr-installer")]);
      return (await count(tx, "select count(*) from public.purchases where product_id = $1", [P("pr-installer")])) === 1 && !!a.id;
    }),
    "racheter une ressource déjà achetée ne crée pas de doublon",
  );
  ok(await rejects(INES, "select public.purchase_product_simulated($1)", [P("pr-ecoles")]), "un brouillon ne s'achète pas");
  ok(await rejects(HANA, "select public.purchase_product_simulated($1)", [P("pr-modeles")]), "un compte gratuit n'achète pas");
  ok(
    String(await asAfter("update public.engagement_settings set simulated_payments = false", INES, (tx) => tx.query("select public.purchase_product_simulated($1)", [P("pr-modeles")])))
      .includes("payment_unavailable"),
    "paiement simulé coupé : l'achat est refusé",
  );
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("update public.products set status = 'published' where id = $1", [P("pr-ecoles")]);
      return (await one(tx, "select status from public.products where id = $1", [P("pr-ecoles")])).status === "published";
    }),
    "Julia publie une ressource",
  );
  ok(
    await as(INES, async (tx) => {
      await tx.query("update public.products set price = 0 where id = $1", [P("pr-societe")]);
      return Number((await one(tx, "select price from public.products where id = $1", [P("pr-societe")])).price) === 59;
    }),
    "Inès ne modifie pas un prix",
  );

  console.log("\nEngagement · Espace Business");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.business_deals"))) === 4, "Inès ne voit que ses 4 deals");
  ok(
    (await as(INES, async (tx) => {
      await tx.query("insert into public.business_deals (declared_by, partner_id, nature, deal_date) values ($1, $2, 'Atelier communication', '2026-10-14')", [INES, SALMA]);
      return count(tx, "select count(*) from public.business_deals where status = 'pending' and declared_by = $1", [INES]);
    })) === 2,
    "Inès déclare un deal avec Salma (en attente)",
  );
  ok(await rejects(INES, "insert into public.business_deals (declared_by, partner_id, nature, deal_date) values ($1, $2, 'Faux deal', '2026-10-14')", [SALMA, YASMINE]), "…pas au nom d'une autre");
  ok(await rejects(INES, "insert into public.business_deals (declared_by, partner_id, nature, deal_date) values ($1, $2, 'Hors cercle', '2026-10-14')", [INES, HANA]), "…pas avec un compte gratuit");
  ok(
    await rejects(INES, "insert into public.business_deals (declared_by, partner_id, nature, deal_date, status, points_each) values ($1, $2, 'Auto-confirmé', '2026-10-14', 'confirmed', 99)", [INES, SALMA]),
    "…ni déjà confirmé avec des points",
  );
  ok(
    await as(INES, async (tx) => {
      await tx.query("update public.business_deals set status = 'confirmed' where id = $1", [D("dl-12")]);
      return (await one(tx, "select status from public.business_deals where id = $1", [D("dl-12")])).status === "pending";
    }),
    "Inès ne confirme pas elle-même le deal qu'elle a déclaré",
  );
  ok(await rejects(INES, "select public.respond_deal($1, true)", [D("dl-12")]), "respond_deal refuse la déclarante");
  ok(
    await as(INES, async (tx) => {
      const r = await one(tx, "select * from public.respond_deal($1, true)", [D("dl-13")]);
      const mine = await count(tx, "select count(*) from public.points_ledger where ref_id = $1", [D("dl-13")]);
      await tx.exec("reset role");
      const both = await count(tx, "select count(*) from public.points_ledger where ref_id = $1 and points = 12", [D("dl-13")]);
      return r.status === "confirmed" && r.points_each === 12 && mine === 1 && both === 2;
    }),
    "Inès confirme le deal de Yasmine : 12 points chacune (barème 10 + 2 par tranche de 1 000)",
  );
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.points_ledger where profile_id <> $1", [INES]))) === 0, "Inès ne voit que ses points");
  ok(
    await as(INES, async (tx) => {
      const rows = (await tx.query("select * from public.business_leaderboard(50)")).rows;
      return rows.length > 5 && !rows.some((r) => r.profile_id === YASMINE) && rows.some((r) => r.profile_id === INES);
    }),
    "classement : Yasmine (retirée du classement) n'y figure pas",
  );
  ok((await as(HANA, (tx) => count(tx, "select count(*) from public.business_leaderboard(50)"))) === 0, "classement vide pour un compte gratuit");
  ok(await as(INES, async (tx) => {
    const r = await tx.query("delete from public.business_deals where id = $1 returning id", [D("dl-12")]);
    return r.rows.length === 1;
  }), "Inès retire un deal en attente qu'elle a déclaré");
  ok(await as(INES, async (tx) => {
    const r = await tx.query("delete from public.business_deals where id = $1 returning id", [D("dl-4")]);
    return r.rows.length === 0;
  }), "…mais pas un deal confirmé");

  console.log("\nEngagement · parrainage");
  ok((await as(INES, async (tx) => (await one(tx, "select public.my_referral_code() as c")).c)) === "INES-7K2Q", "Inès retrouve son code INES-7K2Q");
  ok(await rejects(HANA, "select public.my_referral_code()"), "un compte gratuit n'a pas de code de parrainage");
  ok(
    /^SALMA-|^[A-Z]+-[A-Z0-9]{4}$/.test(String(await as(uuid("p-nadia"), async (tx) => (await one(tx, "select public.my_referral_code() as c")).c))),
    "Nadia obtient un code personnel créé à la demande",
  );
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.referrals"))) === 3, "Inès voit ses 3 filleules");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.referrals where referrer_id <> $1", [INES]))) === 0, "…pas celles des autres");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.referral_reward_grants"))) === 2, "Inès voit ses 2 récompenses");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.referral_rewards"))) === 2, "les récompenses actives sont visibles (pas l'inactive)");
  ok(await rejects(INES, "insert into public.referral_rewards (kind, label) values ('other', 'Cadeau')"), "Inès ne crée pas de récompense");
  ok(await rejects(INES, "insert into public.referral_codes (profile_id, code) values ($1, 'VIP-0000')", [INES]), "Inès ne choisit pas son code à la main");

  const ZOE = "00000000-0000-4000-a000-00000000e406";
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${ZOE}', 'zoe@exemple.test', '{"first_name":"Zoé"}') on conflict do nothing`);
  await db.exec(`update public.profiles set first_name = 'Zoé', last_name = 'Martin' where id = '${ZOE}'`);
  ok(
    await as(ZOE, async (tx) => {
      const r = await one(tx, "select * from public.claim_referral('ines-7k2q')");
      const again = await one(tx, "select * from public.claim_referral('SALMA-4FJD')");
      await tx.exec("reset role");
      const notif = await count(tx, "select count(*) from public.notifications where recipient_id = $1 and type = 'referral_signup'", [INES]);
      return r.referrer_id === INES && r.referred_name === "Zoé M." && again.id === null && notif === 1;
    }),
    "Zoé s'inscrit avec le code d'Inès (une seule fois) ; Inès est prévenue",
  );
  ok((await as(INES, async (tx) => (await one(tx, "select * from public.claim_referral('SALMA-4FJD')")).id)) === null, "une membre ne peut plus être parrainée");
  ok((await as(INES, async (tx) => (await one(tx, "select * from public.claim_referral('INES-7K2Q')")).id)) === null, "on ne se parraine pas soi-même");

  // Zoé s'inscrit pour de bon, puis devient membre (rôle ajouté) : récompenses attribuées à Inès.
  await db.exec(`select set_config('request.jwt.claim.sub', '${ZOE}', false)`);
  await db.exec("set role authenticated");
  await db.query("select public.claim_referral('INES-7K2Q')");
  await db.exec("reset role");
  await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("insert into public.user_roles (profile_id, role, granted_by) values ($1, 'member', $2)", [ZOE, JULIA]);
      await tx.exec("reset role");
      const ref = await one(tx, "select status, converted_at from public.referrals where referred_id = $1", [ZOE]);
      const grants = await count(tx, "select count(*) from public.referral_reward_grants g join public.referrals r on r.id = g.referral_id where r.referred_id = $1", [ZOE]);
      const pts = await count(tx, "select coalesce(sum(points), 0) from public.points_ledger where profile_id = $1 and source = 'referral' and label like '%Zoé%'", [INES]);
      const notif = await count(tx, "select count(*) from public.notifications where recipient_id = $1 and type = 'referral_rewarded'", [INES]);
      return ref.status === "member" && !!ref.converted_at && grants === 2 && pts === 50 && notif === 1;
    }),
    "Zoé devient membre : parrainage converti, mois offert + 50 points pour Inès, notification",
  );

  console.log("\nEngagement · préférences et réglages");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.engagement_prefs"))) === 1, "Inès ne lit que ses préférences");
  ok(
    await as(INES, async (tx) => {
      await tx.query("insert into public.engagement_prefs (profile_id, widgets) values ($1, '[{\"id\":\"weather\",\"enabled\":false}]') on conflict (profile_id) do update set widgets = excluded.widgets", [INES]);
      return (await one(tx, "select widgets from public.engagement_prefs where profile_id = $1", [INES])).widgets[0].enabled === false;
    }),
    "Inès enregistre l'ordre de ses widgets",
  );
  ok(await rejects(INES, "insert into public.engagement_prefs (profile_id) values ($1)", [SALMA]), "…pas ceux de Salma");
  ok(
    await as(INES, async (tx) => {
      await tx.query("update public.engagement_settings set deal_points_base = 500");
      return (await one(tx, "select deal_points_base from public.engagement_settings")).deal_points_base === 10;
    }),
    "Inès lit le barème sans pouvoir le changer",
  );
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("update public.engagement_settings set deal_points_base = 20 where id = 1");
      return (await one(tx, "select public.deal_points(2500) as p")).p === 24;
    }),
    "Julia change le barème (20 + 2 × 2 = 24 points pour 2 500 $)",
  );
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("insert into public.notifications (recipient_id, type, title) values ($1, 'deal_declared', 'Deal'), ($1, 'booking_confirmed', 'Billet')", [JULIA]);
      await tx.query("insert into public.audit_log (actor_id, action, target_type, summary) values ($1, 'product.publish', 'product', 'Ressource publiée')", [JULIA]);
      return true;
    }),
    "nouveaux types de notification et cibles du journal acceptés, anciens conservés",
  );
}
