/**
 * Vague 2 · Contrats — règles pures : numéro unique, échéancier, montants, variables, document final.
 * Sans dépendance à Next ni à la base (lu aussi par les scripts de test et de seed).
 */
import { createHash, randomBytes } from "node:crypto";
import { renderContractPdf } from "./pdf.ts";
import { cleanValue, fillVariables, parseBlocks, stripNotes } from "./render.ts";
import type { ContractKind, ScheduleItem } from "./types.ts";

export const CLUB_NAME = "Nomad Club";

const PREFIX: Record<ContractKind, string> = { membership: "ADH", partner: "PAR", pro: "PRO" };
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const NUMBER_RE = /^NC-(ADH|PAR|PRO)-\d{4}-[A-Z0-9]{6}$/;

/** NC-ADH-2026-7K2Q9M : préfixe du type, année, six caractères aléatoires (unicité garantie par la base). */
export function contractNumber(kind: ContractKind, year: number, bytes: Uint8Array = randomBytes(6)): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `NC-${PREFIX[kind]}-${year}-${s}`;
}

/** Devise de l'appli (NEXT_PUBLIC_CURRENCY, USD par défaut, comme la maquette). */
export function appCurrency(): string {
  const c = (process.env.NEXT_PUBLIC_CURRENCY || "USD").toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : "USD";
}

/** 670 → « 670 $ », 223.33 → « 223,33 $ » (format français, devise du contrat). */
export function formatAmount(amount: number, currency: string): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** « 2 novembre 2026 » (AAAA-MM-JJ, sans décalage de fuseau). */
export function dateLong(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Échéances acceptées pour l'adhésion (1, 3 ou 12 fois) ; les pros paient au mois, les partenaires rien. */
export const MEMBERSHIP_INSTALLMENTS = [1, 3, 12] as const;

/**
 * Échéancier : montant réparti au centime près (l'arrondi va sur la première échéance), une échéance par mois
 * à partir de la date de début. Pro : une échéance mensuelle renouvelée. Partenaire : aucune.
 */
export function buildSchedule(kind: ContractKind, amount: number, installments: number, startsOn: string): ScheduleItem[] {
  if (kind === "partner" || amount <= 0) return [];
  if (kind === "pro") return [{ n: 1, dueOn: startsOn, amount, label: "puis le même jour chaque mois, tant que l'abonnement n'est pas arrêté" }];
  const n = Math.max(1, Math.min(12, Math.round(installments)));
  const cents = Math.round(amount * 100);
  const part = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, dueOn: addMonths(startsOn, i), amount: (i === 0 ? cents - part * (n - 1) : part) / 100 }));
}

const WORDS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];

export function installmentsWords(n: number): string {
  if (n <= 1) return "une seule fois (comptant)";
  return `${WORDS[n] ?? n} fois`;
}

/** Échéancier en liste Markdown (inséré tel quel dans le modèle : valeurs calculées par l'appli, jamais saisies). */
export function scheduleMarkdown(kind: ContractKind, schedule: ScheduleItem[], currency: string): string {
  if (!schedule.length) return "- Aucun paiement n'est dû au titre du présent contrat.";
  return schedule
    .map((s) =>
      kind === "pro"
        ? `- ${formatAmount(s.amount, currency)} le ${dateLong(s.dueOn)}, ${s.label ?? "puis chaque mois"}.`
        : `- Échéance ${s.n} : ${formatAmount(s.amount, currency)} le ${dateLong(s.dueOn)}${s.n === 1 ? " (à la souscription)" : ""}.`,
    )
    .join("\n");
}

export type VarContext = {
  kind: ContractKind;
  number: string;
  /** Date de génération (ISO). */
  createdAt: string;
  templateVersion: number;
  signer: { name: string; email: string | null; phone: string | null; card: string | null };
  organization: { name: string; address: string | null; category: string | null } | null;
  plan: { code: string; label: string; perks: string };
  amount: number;
  currency: string;
  installments: number;
  schedule: ScheduleItem[];
  startsOn: string;
  endsOn: string | null;
};

/** Valeurs des variables {{…}} (les valeurs saisies par les personnes sont nettoyées). */
export function buildVariables(c: VarContext): Record<string, string> {
  const v = (s: string | null | undefined, fallback = "non renseigné") => cleanValue(s) || fallback;
  return {
    "club.nom": CLUB_NAME,
    "contrat.numero": c.number,
    "contrat.date": dateLong(c.createdAt.slice(0, 10)),
    "modele.version": String(c.templateVersion),
    "signataire.nom": v(c.signer.name, "[NOM DE LA SIGNATAIRE]"),
    "signataire.email": v(c.signer.email),
    "signataire.telephone": v(c.signer.phone, "numéro non renseigné"),
    "signataire.carte": v(c.signer.card, "attribuée à l'activation"),
    "etablissement.nom": v(c.organization?.name, "[ÉTABLISSEMENT]"),
    "etablissement.adresse": v(c.organization?.address, "[ADRESSE]"),
    "etablissement.categorie": v(c.organization?.category, "activité non précisée"),
    "formule.nom": v(c.plan.label),
    "formule.avantages": v(c.plan.perks, "voir la présentation des formules dans l'application"),
    "montant.total": formatAmount(c.amount, c.currency),
    "montant.mensuel": formatAmount(c.amount, c.currency),
    "montant.devise": c.currency,
    "echeancier.nombre": installmentsWords(c.kind === "membership" ? c.installments : 1),
    "echeancier.detail": scheduleMarkdown(c.kind, c.schedule, c.currency),
    "dates.debut": dateLong(c.startsOn),
    "dates.fin": c.endsOn ? dateLong(c.endsOn) : "sans terme fixe",
  };
}

/** Texte du contrat : variables remplies, notes internes retirées. */
export function renderBody(templateMd: string, vars: Record<string, string>): string {
  return stripNotes(fillVariables(templateMd, vars));
}

export const CLOSING_TEXT =
  "Ce document est accepté électroniquement dans l'application Nomad Club, en cochant la case « J'ai lu et j'accepte ». La preuve de l'acceptation (date et heure, adresse IP, navigateur, version du modèle et empreinte SHA-256 de ce fichier PDF) est conservée par le Club et figure sur le certificat d'acceptation téléchargeable dans « Mes contrats ».";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** PDF du contrat à partir de son texte rendu : déterministe (même texte, même numéro, même date → mêmes octets). */
export async function contractPdf(input: { number: string; bodyMd: string; createdAt: string; templateVersion: number; title: string }): Promise<Uint8Array> {
  const blocks = parseBlocks(input.bodyMd);
  return renderContractPdf(blocks, {
    title: blocks.find((b) => b.t === "h1")?.t === "h1" ? (blocks.find((b) => b.t === "h1") as { text: string }).text : input.title,
    subject: `Contrat ${input.number}`,
    headerRight: `Contrat n° ${input.number}`,
    footerLeft: `${CLUB_NAME} · contrat ${input.number} · modèle version ${input.templateVersion}`,
    date: input.createdAt,
    closing: CLOSING_TEXT,
  });
}

/** Document complet d'un nouveau contrat : variables, texte, PDF et empreinte. */
export async function buildContractDocument(templateMd: string, ctx: VarContext, title: string) {
  const variables = buildVariables(ctx);
  const bodyMd = renderBody(templateMd, variables);
  const pdf = await contractPdf({ number: ctx.number, bodyMd, createdAt: ctx.createdAt, templateVersion: ctx.templateVersion, title });
  return { variables, bodyMd, pdf, sha256: sha256Hex(pdf) };
}

export type PlanInfo = { code: string; label: string; perks: string };

/** Formules d'adhésion (prix : src/lib/content.ts) et partenariat. Les formules pro viennent de partenaires/domain.ts. */
export const MEMBERSHIP_PLAN_INFO: Record<string, PlanInfo> = {
  member: { code: "member", label: "Membre", perks: "l'application du club, les rendez-vous au tarif membre, les offres partenaires et le carnet d'adresses" },
  premium: {
    code: "premium",
    label: "Premium",
    perks: "tout ce que comprend la formule Membre, les rendez-vous Premium offerts, une invitée par trimestre et la priorité sur les dîners",
  },
};

export const PARTNER_PLAN_INFO: PlanInfo = { code: "partenaire", label: "Partenariat offres membres", perks: "la publication d'offres réservées aux membres, la validation des codes et les statistiques de l'établissement" };
