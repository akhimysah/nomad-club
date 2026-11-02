/**
 * Catalogue des widgets de l'accueil membre (module pur : importable côté serveur et client).
 * Obligatoires : prochain rendez-vous, actualités, prochains événements (toujours affichés, réordonnables).
 * Facultatifs : activés / désactivés / réordonnés par chaque membre (table engagement_prefs).
 */
import type { IconName } from "@/components/IconSprite";
import type { WidgetId, WidgetPref } from "./types";

export type WidgetDef = {
  id: WidgetId;
  label: string;
  hint: string;
  icon: IconName;
  mandatory: boolean;
  /** Colonne sur ordinateur : grands blocs à gauche, cartes à droite. Sur téléphone, une seule colonne dans l'ordre choisi. */
  column: "main" | "side";
  defaultOn: boolean;
};

/** Ordre par défaut. */
export const WIDGETS: readonly WidgetDef[] = [
  { id: "next", label: "Mon prochain rendez-vous", hint: "Billet et compte à rebours.", icon: "ticket", mandatory: true, column: "main", defaultOn: true },
  { id: "adhesion", label: "Mon adhésion", hint: "Jours restants et renouvellement.", icon: "card", mandatory: false, column: "side", defaultOn: true },
  { id: "news", label: "Actualités du club", hint: "Les dernières publications.", icon: "bell", mandatory: true, column: "side", defaultOn: true },
  { id: "events", label: "Bientôt au club", hint: "Les prochains rendez-vous.", icon: "cal", mandatory: true, column: "main", defaultOn: true },
  { id: "weather", label: "Météo à Marrakech", hint: "Aujourd’hui et les trois jours suivants.", icon: "globe", mandatory: false, column: "side", defaultOn: true },
  { id: "prayer", label: "Heures de prière", hint: "À Marrakech, méthode du Maroc.", icon: "clock", mandatory: false, column: "side", defaultOn: false },
  { id: "agenda", label: "Mon agenda", hint: "Mes réservations à venir.", icon: "cal", mandatory: false, column: "side", defaultOn: false },
  { id: "salon", label: "Dans le salon", hint: "Les derniers messages du salon Général.", icon: "chat", mandatory: false, column: "side", defaultOn: true },
  { id: "offers", label: "Offres du moment", hint: "Les avantages de nos partenaires.", icon: "gift", mandatory: false, column: "side", defaultOn: false },
  { id: "points", label: "Mes points Business", hint: "Mes points et mes deals à confirmer.", icon: "star", mandatory: false, column: "side", defaultOn: false },
  { id: "referral", label: "Parrainage", hint: "Mon code et mes filleules.", icon: "users", mandatory: false, column: "side", defaultOn: false },
  { id: "quote", label: "Citation du jour", hint: "Une phrase pour la journée.", icon: "spark", mandatory: false, column: "side", defaultOn: false },
  { id: "ask", label: "Demander à l’assistant", hint: "Une question sur Marrakech.", icon: "spark", mandatory: false, column: "side", defaultOn: true },
  { id: "address", label: "Une adresse du carnet", hint: "Une recommandation du club.", icon: "book", mandatory: false, column: "main", defaultOn: true },
];

const BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

export function isWidgetId(v: unknown): v is WidgetId {
  return typeof v === "string" && BY_ID.has(v as WidgetId);
}

export type ResolvedWidget = WidgetDef & { enabled: boolean };

/** Ordre et activation effectifs : préférences enregistrées d'abord, widgets inconnus ignorés, nouveaux ajoutés à la fin. */
export function resolveWidgets(prefs: readonly WidgetPref[] | null | undefined): ResolvedWidget[] {
  const out: ResolvedWidget[] = [];
  const seen = new Set<WidgetId>();
  for (const p of prefs ?? []) {
    const def = BY_ID.get(p.id);
    if (!def || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ ...def, enabled: def.mandatory || Boolean(p.enabled) });
  }
  for (const def of WIDGETS) if (!seen.has(def.id)) out.push({ ...def, enabled: def.mandatory || def.defaultOn });
  return out;
}

/** Valide ce que renvoie le navigateur avant de l'enregistrer. */
export function sanitizeWidgetPrefs(input: unknown): WidgetPref[] | null {
  if (!Array.isArray(input) || input.length > 40) return null;
  const out: WidgetPref[] = [];
  const seen = new Set<string>();
  for (const x of input) {
    if (!x || typeof x !== "object") return null;
    const { id, enabled } = x as { id?: unknown; enabled?: unknown };
    if (!isWidgetId(id) || seen.has(id)) return null;
    seen.add(id);
    out.push({ id, enabled: BY_ID.get(id)!.mandatory || enabled === true });
  }
  return resolveWidgets(out).map(({ id, enabled }) => ({ id, enabled }));
}
