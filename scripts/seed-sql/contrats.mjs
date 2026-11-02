// Vague 2 · Contrats — lignes SQL des contrats d'exemple (0010_contrats.sql), à partir de
// src/lib/modules/contrats/seed.ts. Les modèles v1 sont insérés par la migration elle-même.
// Un contrat naît « en attente » (déclencheur protect_contract) : on insère le contrat, puis la preuve,
// puis on le passe « accepté » (le déclencheur vérifie que la preuve existe).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Formules pro (copie de PRO_PLANS, src/lib/modules/partenaires/domain.ts, non importable sans bundler). */
const PRO_PLANS = {
  essentiel: { label: "Essentiel", perks: ["Fiche dans le carnet des membres", "Coordonnées, horaires, WhatsApp", "Statistiques de visibilité"] },
  visibilite: { label: "Visibilité", perks: ["Tout l’Essentiel", "Photos (jusqu’à 8) et position sur la carte", "Réduction membres mise en avant"] },
  vitrine: { label: "Vitrine", perks: ["Tout Visibilité", "En tête du carnet dans ta catégorie", "Présentation au lunch mensuel du club"] },
};

/** @param {{ s: any, insert: Function, out: Function, q: Function, uuid: Function, json: Function }} ctx */
export default async function contratsSeedSql({ s, insert, out, q, uuid, json }) {
  const { buildSeedContracts } = await import(join(root, "src/lib/modules/contrats/seed-build.ts"));
  const people = {
    profile(id) {
      const p = s.profiles.find((x) => x.id === id);
      return p ? { name: `${p.firstName} ${p.lastName}`.trim() || p.firstName, email: p.email, phone: p.whatsapp, card: p.cardNumber } : null;
    },
    organization(id) {
      const o = s.organizations.find((x) => x.id === id);
      return o ? { name: o.name, address: [o.address, o.area].filter(Boolean).join(", ") || null, category: o.category } : null;
    },
    proPlan(code) {
      const p = PRO_PLANS[code];
      return p ? { code, label: p.label, perks: p.perks.join(", ").toLowerCase() } : null;
    },
  };
  const built = await buildSeedContracts(people, (process.env.NEXT_PUBLIC_CURRENCY || "USD").toUpperCase());
  out("-- Contrats d'exemple (0010_contrats.sql) : adhésions, partenaires, pro.");
  insert(
    "contracts",
    ["id", "number", "kind", "template_id", "template_version", "profile_id", "organization_id", "plan", "amount", "currency", "installments", "schedule", "starts_on", "ends_on", "variables", "body_md", "pdf_sha256", "subscription_ref", "source", "created_at", "reminded_at", "reminder_count"],
    built.map(({ contract: c }) => [
      q(uuid(c.id)), q(c.number), q(c.kind), q(c.templateId), c.templateVersion, q(uuid(c.profileId)), q(uuid(c.organizationId)), q(c.plan), c.amount, q(c.currency), c.installments,
      json(c.schedule), q(c.startsOn), q(c.endsOn), json(c.variables), q(c.bodyMd), q(c.pdfSha256), q(c.subscriptionRef), q(c.source), q(c.createdAt), q(c.remindedAt), c.reminderCount,
    ]),
    "on conflict (id) do nothing",
  );
  const accepted = built.filter((b) => b.acceptance);
  insert(
    "contract_acceptances",
    ["id", "contract_id", "profile_id", "signer_name", "signer_email", "accepted_at", "ip", "user_agent", "template_version", "pdf_sha256", "provider", "method", "statement"],
    accepted.map(({ acceptance: a }) => [q(uuid(a.id)), q(uuid(a.contractId)), q(uuid(a.profileId)), q(a.signerName), q(a.signerEmail), q(a.acceptedAt), q(a.ip), q(a.userAgent), a.templateVersion, q(a.pdfSha256), q(a.provider), q(a.method), q(a.statement)]),
    "on conflict (contract_id) do nothing",
  );
  for (const { contract: c, acceptance: a } of accepted) out(`update public.contracts set status = 'accepted', accepted_at = ${q(a.acceptedAt)} where id = ${q(uuid(c.id))} and status = 'pending';`);
  out("");
}
