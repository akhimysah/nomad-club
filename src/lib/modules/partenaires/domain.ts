/**
 * Lot 3 — règles métier pures (sans base ni cookies) : formules pro, statut effectif d'un abonnement,
 * disponibilité d'une offre pour une membre, positions approximatives, quartiers, mois de statistiques.
 */
import { normalize } from "../../format";
import type { Plan, PlaceCategory } from "../../types";
import { QUARTIERS } from "./seed";
import type { MonthlyStats, Offer, OfferAudience, PartenairesAuditAction, ProPlan, ProSubscription, SubscriptionStatus } from "./types";

export { QUARTIERS };

/* ---------- formules du carnet pro ---------- */

export const PRO_PLANS: Record<ProPlan, { label: string; price: number; perks: string[] }> = {
  essentiel: { label: "Essentiel", price: 29, perks: ["Fiche dans le carnet des membres", "Coordonnées, horaires, WhatsApp", "Statistiques de visibilité"] },
  visibilite: { label: "Visibilité", price: 49, perks: ["Tout l’Essentiel", "Photos (jusqu’à 8) et position sur la carte", "Réduction membres mise en avant"] },
  vitrine: { label: "Vitrine", price: 89, perks: ["Tout Visibilité", "En tête du carnet dans ta catégorie", "Présentation au lunch mensuel du club"] },
};

export const PRO_PLAN_KEYS = Object.keys(PRO_PLANS) as ProPlan[];

export function isProPlan(v: unknown): v is ProPlan {
  return typeof v === "string" && v in PRO_PLANS;
}

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, { label: string; cls: string; hint: string }> = {
  active: { label: "Actif", cls: "chip solid", hint: "Ta fiche est visible dans le carnet." },
  past_due: { label: "En retard", cls: "chip gold", hint: "Échéance dépassée : ta fiche est masquée jusqu’au paiement." },
  suspended: { label: "Suspendu", cls: "chip rose", hint: "Plus de 15 jours de retard : fiche masquée. Règle l’échéance pour la remettre en ligne." },
  cancelled: { label: "Arrêté", cls: "chip rose", hint: "Abonnement arrêté : fiche masquée." },
};

/** Délai de grâce avant suspension (jours après l'échéance). */
export const GRACE_DAYS = 15;

function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** AAAA-MM-JJ + n mois (le jour est ramené à 28 au plus pour rester valide). */
export function addMonthsYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, 28))).toISOString().slice(0, 10);
}

/** Statut réel à une date donnée (une échéance dépassée passe en retard, puis suspendu). */
export function effectiveStatus(s: Pick<ProSubscription, "status" | "currentPeriodEnd" | "cancelAtPeriodEnd">, todayYmd: string): SubscriptionStatus {
  if (s.status === "suspended" || s.status === "cancelled") return s.status;
  if (s.currentPeriodEnd >= todayYmd) return s.status;
  if (s.cancelAtPeriodEnd) return "cancelled";
  return addDaysYmd(s.currentPeriodEnd, GRACE_DAYS) < todayYmd ? "suspended" : "past_due";
}

/** Une fiche pro n'est visible dans le carnet et sur la carte que si l'abonnement est actif. */
export function isListed(s: ProSubscription | null | undefined, todayYmd: string): boolean {
  return !!s && effectiveStatus(s, todayYmd) === "active";
}

/** Période couverte par le prochain paiement : depuis l'échéance si elle n'est pas dépassée, sinon depuis aujourd'hui. */
export function nextPeriod(s: Pick<ProSubscription, "currentPeriodEnd"> | null, todayYmd: string): { start: string; end: string } {
  const start = s && s.currentPeriodEnd >= todayYmd ? s.currentPeriodEnd : todayYmd;
  return { start, end: addMonthsYmd(start, 1) };
}

/* ---------- offres ---------- */

export const AUDIENCE_LABEL: Record<OfferAudience, string> = { all: "Toutes les membres", member: "Formule Membre et Premium", premium: "Réservée Premium" };

export function isAudience(v: unknown): v is OfferAudience {
  return v === "all" || v === "member" || v === "premium";
}

/** Une offre est-elle utilisable aujourd'hui par cette membre ? Renvoie la raison sinon. */
export function offerAvailability(o: Pick<Offer, "status" | "validFrom" | "validUntil" | "audience">, plan: Plan, todayYmd: string, admin = false): { ok: true } | { ok: false; reason: string } {
  if (o.status !== "active") return { ok: false, reason: "Offre en pause." };
  if (o.validFrom && o.validFrom > todayYmd) return { ok: false, reason: "Pas encore commencée." };
  if (o.validUntil && o.validUntil < todayYmd) return { ok: false, reason: "Offre terminée." };
  if (o.audience === "premium" && plan !== "premium" && !admin) return { ok: false, reason: "Réservée aux membres Premium." };
  return { ok: true };
}

/** Saisie au comptoir : « of 7kqd m3xp » → « OF-7KQD-M3XP ». Null si ce n'est pas un code d'offre. */
export function normalizeOfferCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("OF") ? s.slice(2) : s;
  if (!/^[A-Z0-9]{8}$/.test(body)) return null;
  return `OF-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Le QR encode l'adresse de validation : scanné avec l'appareil photo du téléphone, il ouvre l'espace partenaire. */
export function validationUrl(site: string, code: string): string {
  return `${site}/partenaire/valider?code=${encodeURIComponent(code)}`;
}

/* ---------- statistiques ---------- */

/** Les n derniers mois (AAAA-MM), du plus ancien au mois en cours. */
export function lastMonths(todayYmd: string, n: number): string[] {
  const [y, m] = todayYmd.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export function emptyMonth(month: string): MonthlyStats {
  return { month, views: 0, contactClicks: 0, whatsappClicks: 0, directionsClicks: 0, codesGenerated: 0, codesValidated: 0 };
}

export function sumStats(rows: MonthlyStats[]): Omit<MonthlyStats, "month"> {
  return rows.reduce(
    (a, r) => ({
      views: a.views + r.views,
      contactClicks: a.contactClicks + r.contactClicks,
      whatsappClicks: a.whatsappClicks + r.whatsappClicks,
      directionsClicks: a.directionsClicks + r.directionsClicks,
      codesGenerated: a.codesGenerated + r.codesGenerated,
      codesValidated: a.codesValidated + r.codesValidated,
    }),
    { views: 0, contactClicks: 0, whatsappClicks: 0, directionsClicks: 0, codesGenerated: 0, codesValidated: 0 },
  );
}

/* ---------- carte et quartiers ---------- */

/** Pas de la grille d'arrondi (~550 m en latitude à Marrakech). */
export const BLUR_STEP = 0.005;

export function blur(v: number): number {
  return Math.round(Math.round(v / BLUR_STEP) * BLUR_STEP * 1e6) / 1e6;
}

export function quartier(name: string | null | undefined) {
  if (!name) return null;
  const n = normalize(name);
  return QUARTIERS.find((q) => normalize(q.name) === n) ?? null;
}

/** Quartier le plus proche d'un point (pour nommer une position approximative). */
export function nearestQuartier(lat: number, lng: number): string {
  let best = QUARTIERS[0];
  let d = Infinity;
  for (const q of QUARTIERS) {
    const dd = (q.lat - lat) ** 2 + ((q.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (dd < d) {
      d = dd;
      best = q;
    }
  }
  return best.name;
}

/** Marrakech et ses environs (garde-fou des coordonnées saisies). */
export function inMarrakech(lat: number, lng: number): boolean {
  return lat > 31.45 && lat < 31.8 && lng > -8.2 && lng < -7.8;
}

/** Quartier « simple » d'une adresse du carnet (« Médina – Rahba Kedima » → « Médina »), pour le filtre. */
export function areaKey(area: string | null | undefined): string {
  if (!area) return "Autres";
  const n = normalize(area);
  const q = QUARTIERS.find((x) => n.includes(normalize(x.name)));
  if (q) return q.name;
  if (n.includes("toute la ville")) return "Toute la ville";
  return "Autres";
}

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  manger: "Manger",
  sortir: "Sortir",
  "hotels-piscines": "Hôtels et piscines",
  "bien-etre-sport": "Bien-être et sport",
  beaute: "Beauté",
  sante: "Santé",
  urgences: "Urgences",
  shopping: "Shopping",
  pratique: "Pratique",
  famille: "En famille",
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL) as PlaceCategory[];

export function isCategory(v: unknown): v is PlaceCategory {
  return typeof v === "string" && v in CATEGORY_LABEL;
}

/* ---------- journal ---------- */

export const PARTENAIRES_AUDIT_LABEL: Record<PartenairesAuditAction, string> = {
  "organization.update": "Fiche établissement modifiée",
  "organization.invite": "Collaboratrice invitée",
  "offer.create": "Offre créée",
  "offer.update": "Offre modifiée",
  "offer.pause": "Offre mise en pause",
  "offer.resume": "Offre remise en ligne",
  "offer_code.validate": "Code d’offre validé",
  "subscription.pay": "Abonnement payé",
  "subscription.change": "Formule changée",
  "subscription.cancel": "Abonnement arrêté / repris",
};
