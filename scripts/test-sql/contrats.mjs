// Vague 2 · Contrats — vérifications de la migration 0010_contrats.sql et de la génération PDF :
// modèles versionnés (admin seulement), RLS (chacune ne voit que ses contrats), acceptation par accept_contract()
// uniquement, preuve immuable, contrat figé après acceptation, PDF valide et empreinte SHA-256 cohérente.
// Appelé par scripts/test-sql.mjs avec le banc PGlite déjà migré et rempli.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {{ db: import("@electric-sql/pglite").PGlite, as: Function, rejects: Function, one: Function, count: Function, ok: (c: boolean, l: string) => void, uuid: (id: string) => string }} ctx
 */
export default async function contrats({ db, as, rejects, one, count, ok, uuid }) {
  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const KENZA = uuid("p-g11");
  const LOUBNA = uuid("p-g34");
  const RIM = uuid("p-rim");
  const BLOOM = uuid("org-bloom");
  const CHERKAOUI = uuid("org-cherkaoui");

  const domain = await import(join(root, "src/lib/modules/contrats/domain.ts"));
  const templates = await import(join(root, "src/lib/modules/contrats/templates.ts"));
  const render = await import(join(root, "src/lib/modules/contrats/render.ts"));

  /** Comme `as`, mais valide la transaction (état conservé pour la suite). */
  async function asCommit(userId, fn) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [userId]);
      await tx.exec("set local role authenticated");
      return fn(tx);
    });
  }

  console.log("\nContrats (vague 2 · 0010)");

  /* ---------- modèles ---------- */
  const tpls = (await db.query("select id, kind, version, body_md, is_active from public.contract_templates order by kind")).rows;
  ok(tpls.length === 3 && tpls.every((t) => t.is_active && t.version === 1), "trois modèles v1 actifs (adhésion, partenaire, pro)");
  ok(
    templates.INITIAL_TEMPLATES.every((t) => tpls.find((r) => r.id === t.id)?.body_md === t.bodyMd),
    "les textes de la migration sont identiques à templates.ts (node scripts/contrats-templates-sql.mjs --write)",
  );
  ok(tpls.every((t) => t.body_md.includes(templates.DRAFT_NOTICE)), "chaque modèle commence par l'avertissement « BROUILLON — à faire valider par un juriste »");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.contract_templates"))) === 3, "une membre lit les modèles actifs");
  ok(await rejects(INES, "insert into public.contract_templates (kind, version, title, body_md) values ('membership', 9, 'Pirate', repeat('x', 80))"), "une membre ne crée pas de modèle");
  ok(await rejects(KENZA, "select public.activate_contract_template($1)", [tpls[0].id]), "une partenaire n'active pas de modèle");
  ok(await rejects(null, "select * from public.contract_templates"), "anonyme : modèles interdits");

  const v2 = await asCommit(JULIA, async (tx) => {
    const r = await one(tx, "insert into public.contract_templates (kind, version, title, body_md, effective_from) values ('membership', 2, 'Adhésion v2', $1, '2026-12-01') returning id", [tpls.find((t) => t.kind === "membership").body_md + "\n\nNouvelle clause."]);
    return r.id;
  });
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.contract_templates where id = $1", [v2]))) === 0, "une version non active n'est pas visible des membres");
  await asCommit(JULIA, (tx) => tx.query("select public.activate_contract_template($1)", [v2]));
  const actives = (await db.query("select version from public.contract_templates where kind = 'membership' and is_active")).rows;
  ok(actives.length === 1 && actives[0].version === 2, "activer la v2 désactive la v1 (une seule version active par type)");
  ok(await rejects(JULIA, "update public.contract_templates set is_active = true where kind = 'membership' and version = 1"), "deux versions actives du même type : refusé");
  await asCommit(JULIA, (tx) => tx.query("select public.activate_contract_template($1)", [tpls.find((t) => t.kind === "membership").id]));

  /* ---------- génération PDF ---------- */
  const tplM = templates.INITIAL_TEMPLATES.find((t) => t.kind === "membership");
  const createdAt = "2026-11-02T10:00:00.000Z";
  const number = domain.contractNumber("membership", 2026);
  const ctx = {
    kind: "membership", number, createdAt, templateVersion: 1,
    signer: { name: "Inès Laurent", email: "ines@exemple.com", phone: "+212 6 61 42 18 07", card: "NC 0427" },
    organization: null, plan: domain.MEMBERSHIP_PLAN_INFO.member, amount: 670, currency: "USD", installments: 3,
    schedule: domain.buildSchedule("membership", 670, 3, "2026-11-18"), startsOn: "2026-11-18", endsOn: "2027-11-18",
  };
  const doc = await domain.buildContractDocument(tplM.bodyMd, ctx, tplM.title);
  const head = Buffer.from(doc.pdf.slice(0, 8)).toString("latin1");
  const tail = Buffer.from(doc.pdf.slice(-8)).toString("latin1");
  ok(head.startsWith("%PDF-1.") && tail.includes("%%EOF"), `le contrat généré est un PDF valide (${head.trim()}, ${Math.round(doc.pdf.length / 1024)} Ko)`);
  const { PDFDocument } = await import("pdf-lib");
  const parsed = await PDFDocument.load(doc.pdf);
  ok(parsed.getPageCount() >= 3 && parsed.getTitle() === "Contrat d'adhésion au Nomad Club", `le PDF se relit (${parsed.getPageCount()} pages, titre et métadonnées)`);
  ok(doc.sha256 === domain.sha256Hex(doc.pdf) && /^[0-9a-f]{64}$/.test(doc.sha256), "l'empreinte SHA-256 correspond au fichier");
  const again = await domain.contractPdf({ number, bodyMd: doc.bodyMd, createdAt, templateVersion: 1, title: tplM.title });
  ok(domain.sha256Hex(again) === doc.sha256, "le PDF régénéré à la volée a exactement la même empreinte (rendu déterministe)");
  const altered = await domain.contractPdf({ number, bodyMd: doc.bodyMd.replace("670", "67"), createdAt, templateVersion: 1, title: tplM.title });
  ok(domain.sha256Hex(altered) !== doc.sha256, "la moindre modification du texte change l'empreinte");
  ok(!doc.bodyMd.includes(">>") && !doc.bodyMd.includes("{{") && doc.bodyMd.includes("Inès Laurent") && doc.bodyMd.includes(number), "variables remplies, notes internes retirées du contrat");
  ok(doc.bodyMd.includes("223,34") && doc.bodyMd.includes("18 janvier 2027"), "échéancier en trois fois (arrondi sur la première échéance, une par mois)");
  ok(render.cleanValue("**Ar**\n## 1 {{x}}") === "Ar 1 x", "une valeur saisie ne peut pas injecter de Markdown ni de variable");

  /* ---------- contrats : écriture réservée ---------- */
  const insertSql = `insert into public.contracts (number, kind, template_id, template_version, profile_id, organization_id, plan, amount, currency, installments, schedule, starts_on, ends_on, variables, body_md, pdf_sha256, source)
    values ($1, $2, $3, 0, $4, $5, $6, $7, 'USD', $8, $9::jsonb, $10, $11, $12::jsonb, $13, $14, 'admin') returning id, template_version, status`;
  const paramsFor = (n, kind, profile, org, plan, amount, sha, body = doc.bodyMd) => [
    n, kind, tpls.find((t) => t.kind === kind).id, profile, org, plan, amount, kind === "membership" ? 3 : 1, JSON.stringify(ctx.schedule), "2026-11-18", null, JSON.stringify(doc.variables), body, sha,
  ];
  ok(await rejects(INES, insertSql, paramsFor(domain.contractNumber("membership", 2026), "membership", INES, null, "member", 1, doc.sha256)), "une membre ne peut pas écrire son propre contrat (ex. prix à 1 $)");
  const acceptedSql = insertSql.replace("source)", "source, status)").replace("'admin') returning", "'admin', 'accepted') returning");
  ok(await rejects(JULIA, acceptedSql, paramsFor(domain.contractNumber("membership", 2026), "membership", INES, null, "member", 670, doc.sha256)), "un contrat ne naît jamais « accepté »");
  ok(await rejects(JULIA, insertSql, paramsFor("NC-XYZ-1", "membership", INES, null, "member", 670, doc.sha256)), "numéro de contrat au mauvais format : refusé");
  const ines = await asCommit(JULIA, (tx) => one(tx, insertSql, paramsFor(number, "membership", INES, null, "member", 670, doc.sha256)));
  ok(ines.template_version === 1 && ines.status === "pending", "l'administratrice génère un contrat (version du modèle recopiée, « en attente »)");
  ok(await rejects(JULIA, insertSql, paramsFor(number, "membership", INES, null, "member", 670, doc.sha256)), "numéro unique");
  const shaB = "b".repeat(64);
  const bloom = await asCommit(JULIA, (tx) => one(tx, insertSql, paramsFor(domain.contractNumber("partner", 2026), "partner", KENZA, BLOOM, "partenaire", 0, shaB)));
  const pro = await asCommit(JULIA, (tx) => one(tx, insertSql, paramsFor(domain.contractNumber("pro", 2026), "pro", LOUBNA, CHERKAOUI, "visibilite", 49, "c".repeat(64))));

  /* ---------- lecture : chacune ne voit que ses contrats ---------- */
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.contracts where id in ($1, $2, $3)", [ines.id, bloom.id, pro.id]))) === 1, "Inès ne voit que son contrat");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.contracts where profile_id is distinct from $1", [INES]))) === 0, "…aucun contrat d'une autre personne");
  ok((await as(KENZA, (tx) => count(tx, "select count(*) from public.contracts where id in ($1, $2, $3)", [ines.id, bloom.id, pro.id]))) === 1, "Kenza voit le contrat de Bloom House (et pas les autres)");
  ok((await as(RIM, (tx) => count(tx, "select count(*) from public.contracts where id = $1", [bloom.id]))) === 0, "Rim (Maison Amaj) ne voit pas le contrat de Bloom House");
  ok((await as(LOUBNA, (tx) => count(tx, "select count(*) from public.contracts where id = $1", [pro.id]))) === 1, "Loubna voit le contrat pro de son cabinet");
  ok((await as(JULIA, (tx) => count(tx, "select count(*) from public.contracts where id in ($1, $2, $3)", [ines.id, bloom.id, pro.id]))) === 3, "l'administratrice voit tous les contrats");
  ok(await rejects(null, "select * from public.contracts"), "anonyme : contrats interdits");
  ok(await rejects(INES, "update public.contracts set amount = 1 where id = $1", [ines.id]) || (await as(INES, async (tx) => (await tx.query("update public.contracts set amount = 1 where id = $1", [ines.id])).affectedRows === 0)), "Inès ne modifie pas son contrat");
  ok((await one(db, "select amount::int as a from public.contracts where id = $1", [ines.id])).a === 670, "…le montant est inchangé");

  /* ---------- acceptation ---------- */
  const accept = "select * from public.accept_contract($1, $2, $3, $4, $5)";
  const stmt = `J'ai lu le contrat n° ${number} (modèle version 1) et j'en accepte les conditions.`;
  ok(await rejects(INES, "insert into public.contract_acceptances (contract_id, profile_id, signer_name, template_version, pdf_sha256, statement) values ($1, $2, 'Inès', 1, $3, 'J''accepte tout ça')", [ines.id, INES, doc.sha256]), "pas d'écriture directe d'une preuve");
  ok(await rejects(KENZA, accept, [ines.id, doc.sha256, "1.2.3.4", "UA", stmt]), "une autre personne ne peut pas accepter le contrat d'Inès");
  ok(await rejects(INES, accept, [ines.id, "0".repeat(64), "1.2.3.4", "UA", stmt]), "empreinte différente : acceptation refusée");
  ok(await rejects(JULIA, `update public.contracts set status = 'accepted' where id = $1`, [ines.id]), "passer « accepté » sans preuve : refusé, même pour l'administratrice");
  const acc = await asCommit(INES, (tx) => one(tx, accept, [ines.id, doc.sha256, "105.158.24.17", "Mozilla/5.0 (iPhone)", stmt]));
  ok(acc?.signer_name === "Inès Laurent" && acc.ip === "105.158.24.17" && acc.template_version === 1 && acc.pdf_sha256 === doc.sha256 && acc.provider === "simple", "Inès accepte : horodatage, IP, navigateur, version et empreinte enregistrés");
  const after = await one(db, "select status, accepted_at from public.contracts where id = $1", [ines.id]);
  ok(after.status === "accepted" && after.accepted_at, "le contrat passe « accepté »");
  ok((await count(db, "select count(*) from public.audit_log where action = 'contract.accept' and target_id = $1", [ines.id])) === 1, "acceptation journalisée (contract.accept)");
  ok(await rejects(INES, accept, [ines.id, doc.sha256, "1.2.3.4", "UA", stmt]), "un contrat ne s'accepte qu'une fois");
  ok((await as(INES, (tx) => count(tx, "select count(*) from public.contract_acceptances where contract_id = $1", [ines.id]))) === 1, "Inès lit sa preuve d'acceptation");
  ok((await as(RIM, (tx) => count(tx, "select count(*) from public.contract_acceptances"))) === 0, "Rim ne lit aucune preuve des autres");

  /* ---------- preuve immuable, contrat figé ---------- */
  ok(await rejects(JULIA, "update public.contract_acceptances set ip = '9.9.9.9' where contract_id = $1", [ines.id]), "l'administratrice ne modifie pas une preuve");
  ok(await rejects(JULIA, "delete from public.contract_acceptances where contract_id = $1", [ines.id]), "…ni ne la supprime");
  let superBlocked = false;
  try {
    await db.query("update public.contract_acceptances set accepted_at = now() - interval '1 year' where contract_id = $1", [ines.id]);
  } catch {
    superBlocked = true;
  }
  ok(superBlocked, "même un accès direct à la base (clé service) ne peut pas antidater une preuve");
  ok(await rejects(JULIA, "update public.contracts set body_md = body_md || ' modifié' where id = $1", [ines.id]), "contrat accepté : texte figé");
  ok(await rejects(JULIA, "update public.contracts set amount = 1 where id = $1", [ines.id]), "contrat accepté : montant figé");
  ok(await rejects(JULIA, "update public.contracts set pdf_sha256 = $2 where id = $1", [ines.id, "d".repeat(64)]), "contrat accepté : empreinte figée");
  ok(await rejects(JULIA, "delete from public.contracts where id = $1", [ines.id]), "un contrat accepté ne se supprime pas");
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("update public.contracts set subscription_ref = 'pay-123', reminded_at = now(), reminder_count = 1 where id = $1", [ines.id]);
      return (await one(tx, "select subscription_ref from public.contracts where id = $1", [ines.id])).subscription_ref === "pay-123";
    }),
    "contrat accepté : la référence de souscription peut encore être reliée",
  );
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("update public.contracts set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Résiliation' where id = $1", [ines.id]);
      try {
        await tx.query("savepoint s");
        await tx.query("update public.contracts set status = 'pending' where id = $1", [ines.id]);
        return false;
      } catch {
        return true;
      }
    }),
    "résiliation possible, puis l'annulation est définitive",
  );

  /* ---------- un modèle utilisé ne change plus ---------- */
  ok(await rejects(JULIA, "update public.contract_templates set body_md = body_md || ' retouche' where kind = 'membership' and version = 1"), "modèle utilisé par un contrat : texte non modifiable (nouvelle version obligatoire)");
  ok(await rejects(JULIA, "delete from public.contract_templates where kind = 'membership' and version = 1"), "…et non supprimable");
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("update public.contract_templates set notes = 'Relu le 2 novembre' where kind = 'membership' and version = 1");
      return true;
    }),
    "les notes internes d'un modèle restent modifiables",
  );

  /* ---------- notifications et journal ---------- */
  ok(
    await as(JULIA, async (tx) => {
      await tx.query("insert into public.notifications (recipient_id, type, title, body, link) values ($1, 'contract_ready', 'Ton contrat est prêt', 'À lire et accepter.', '/espace/moi/contrats')", [INES]);
      await tx.query("insert into public.audit_log (actor_id, action, target_type, target_id, summary) values ($1, 'contract.generate', 'contract', $2, 'Contrat généré')", [JULIA, bloom.id]);
      return true;
    }),
    "types de notification et cibles du journal du module acceptés",
  );
  const migration = readFileSync(join(root, "supabase/migrations/0010_contrats.sql"), "utf8");
  ok(!/0009|0011|0012/.test(migration.replace(/0010/g, "")), "0010 ne dépend d'aucune autre migration de la vague 2");
}
