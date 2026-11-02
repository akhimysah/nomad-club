/**
 * Lot 6 — journal des opérations : libellés, familles d'actions, filtres et export CSV.
 * Les libellés sont partiels : une action ajoutée par un autre lot s'affiche avec son code (« domaine.verbe »).
 */
import type { AuditEntry } from "../../types";
import type { AuditFilters } from "./types";

export const AUDIT_LABEL: Partial<Record<string, string>> = {
  "payment.validate": "Virement validé",
  "event.create": "Rendez-vous créé",
  "event.update": "Rendez-vous modifié",
  "event.publish": "Rendez-vous publié",
  "role.grant": "Rôle ajouté",
  "role.revoke": "Rôle retiré",
  "reminder.send": "Relance",
  "data.export": "Export de données personnelles",
  "consent.update": "Consentement modifié",
  "account.delete_request": "Demande de suppression",
  "account.delete_cancel": "Suppression annulée",
  "account.anonymize": "Compte anonymisé",
  "account.delete_reject": "Suppression refusée",
  "auth.login": "Connexion",
  "auth.admin_login": "Connexion administratrice",
  "auth.mfa_enroll": "Double authentification activée",
  "auth.mfa_verify": "Double authentification vérifiée",
  "auth.signout_all": "Déconnexion de tous les appareils",
  "audit.export": "Export du journal",
  "security.settings": "Réglages de sécurité",
  "push.subscribe": "Notifications push activées",
};

/** Les autres lots ajoutent leurs libellés ici (voir audit-labels.ts), sans que ce fichier dépende d'eux. */
export function registerAuditLabels(labels: Partial<Record<string, string>>): void {
  Object.assign(AUDIT_LABEL, labels);
}

/** Familles proposées dans le filtre « Type d'action » (préfixe avant le point). */
export const AUDIT_FAMILIES: Array<{ value: string; label: string }> = [
  { value: "payment", label: "Paiements" },
  { value: "event", label: "Rendez-vous" },
  { value: "role", label: "Rôles" },
  { value: "reminder", label: "Relances" },
  { value: "auth", label: "Connexions et 2FA" },
  { value: "account", label: "Suppressions de compte" },
  { value: "data", label: "Exports de données" },
  { value: "consent", label: "Consentements" },
  { value: "audit", label: "Journal" },
  { value: "security", label: "Sécurité" },
  { value: "offer", label: "Offres partenaires" },
  { value: "offer_code", label: "Codes d’offre" },
  { value: "organization", label: "Établissements" },
  { value: "subscription", label: "Abonnements carnet" },
  { value: "product", label: "Boutique" },
  { value: "referral", label: "Parrainage" },
  { value: "deal", label: "Espace Business" },
  { value: "crm", label: "CRM" },
];

export function auditLabel(action: string): string {
  return AUDIT_LABEL[action] ?? action;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Même logique que le filtre SQL (supabase-repo), pour le mode démo. */
export function auditMatches(e: AuditEntry, f: AuditFilters): boolean {
  if (f.actorId && e.actorId !== f.actorId) return false;
  if (f.action && !(e.action === f.action || e.action.startsWith(f.action + "."))) return false;
  const ymd = e.createdAt.slice(0, 10);
  if (f.fromYmd && ymd < f.fromYmd) return false;
  if (f.toYmd && ymd > f.toYmd) return false;
  if (f.q) {
    const q = norm(f.q);
    if (!norm(`${e.summary} ${e.action} ${JSON.stringify(e.details)}`).includes(q)) return false;
  }
  return true;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Lit les filtres depuis les paramètres d'adresse (valeurs non conformes ignorées). */
export function parseAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const action = get("type");
  const qui = get("qui");
  const du = get("du");
  const au = get("au");
  const q = get("q").slice(0, 80);
  return {
    actorId: qui && /^[\w-]{1,64}$/.test(qui) ? qui : undefined,
    action: action && /^[a-z_]+(\.[a-z_]+)?$/.test(action) ? action : undefined,
    fromYmd: YMD.test(du) ? du : undefined,
    toYmd: YMD.test(au) ? au : undefined,
    q: q || undefined,
  };
}

/** Échappe une cellule CSV (et neutralise les formules pour les tableurs). */
function cell(v: unknown): string {
  let s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function auditCsv(entries: AuditEntry[], names: Map<string, string>): string {
  const head = ["date", "action", "libellé", "par", "cible", "identifiant cible", "résumé", "détails"];
  const rows = entries.map((e) => [
    e.createdAt,
    e.action,
    auditLabel(e.action),
    (e.actorId && names.get(e.actorId)) || (e.actorId ? e.actorId : "Système"),
    e.targetType,
    e.targetId ?? "",
    e.summary,
    e.details,
  ]);
  // BOM : accents corrects à l'ouverture dans Excel
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
