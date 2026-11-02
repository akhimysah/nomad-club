/**
 * Logique du CRM, en fonctions pures (mêmes résultats en démo et en mode réel) :
 * statut recalculé, lignes enrichies, filtres et segments, doublons, tâches, messages préparés.
 */
import { addDays, daysBetween, ymdOf } from "../../clock";
import { fullName, normalize } from "../../format";
import { hasRole } from "../../permissions";
import type { Booking, Organization, Profile } from "../../types";
import { CONTACT_SOURCES, CONTACT_STATUSES, type Contact, type ContactFilter, type ContactRow, type ContactSource, type ContactStatus, type CrmData, type Deal, type Stage, type Task } from "./types";

export function contactName(c: Pick<Contact, "firstName" | "lastName" | "company">): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.company || "Sans nom";
}

/**
 * Statut affiché. Pour une fiche reliée à un compte, il découle des rôles et de l'adhésion
 * (une adhérente dont l'adhésion est échue devient « ancienne membre ») ; sinon, le statut saisi.
 */
export function effectiveStatus(c: Contact, p: Profile | null, today: string): ContactStatus {
  if (!p) return c.status;
  if (hasRole(p, "admin")) return "equipe";
  if (hasRole(p, "member") && p.plan !== "free" && p.planEndsAt) return p.planEndsAt >= today ? "adherente" : "ancienne";
  if (hasRole(p, "partner")) return "partenaire";
  if (hasRole(p, "pro")) return "pro";
  return c.status === "adherente" || c.status === "equipe" ? "prospect" : c.status;
}

export type RowContext = { profiles: Profile[]; bookings: Booking[]; organizations: Organization[] };

/** Opportunité « courante » d'une fiche : la plus récente encore ouverte, sinon la plus récente. */
function currentDeal(deals: Deal[], stages: Map<string, Stage>): Deal | null {
  if (!deals.length) return null;
  const sorted = [...deals].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return sorted.find((d) => stages.get(d.stageId)?.outcome === "open") ?? sorted[0];
}

export function buildRows(data: CrmData, ctx: RowContext, today: string): ContactRow[] {
  const profiles = new Map(ctx.profiles.map((p) => [p.id, p]));
  const orgs = new Map(ctx.organizations.map((o) => [o.id, o]));
  const stages = new Map(data.stages.map((s) => [s.id, s]));
  const booked = new Map<string, number>();
  ctx.bookings.forEach((b) => {
    if (b.profileId && b.status !== "cancelled" && b.status !== "waitlist") booked.set(b.profileId, (booked.get(b.profileId) ?? 0) + 1);
  });
  const evActs = new Map<string, number>();
  const lastAct = new Map<string, string>();
  data.activities.forEach((a) => {
    if (a.type === "event") evActs.set(a.contactId, (evActs.get(a.contactId) ?? 0) + 1);
    if (a.type !== "system" && (!lastAct.has(a.contactId) || lastAct.get(a.contactId)! < a.occurredAt)) lastAct.set(a.contactId, a.occurredAt);
  });
  const open = new Map<string, number>();
  data.tasks.forEach((t) => {
    if (t.contactId && !t.doneAt) open.set(t.contactId, (open.get(t.contactId) ?? 0) + 1);
  });
  const dealsBy = new Map<string, Deal[]>();
  data.deals.forEach((d) => dealsBy.set(d.contactId, [...(dealsBy.get(d.contactId) ?? []), d]));

  return data.contacts.map((c) => {
    const p = c.profileId ? profiles.get(c.profileId) ?? null : null;
    const deal = currentDeal(dealsBy.get(c.id) ?? [], stages);
    return {
      contact: c,
      profile: p,
      name: p ? fullName(p).trim() || contactName(c) : contactName(c),
      email: p?.email || c.email,
      phone: p?.whatsapp || c.phone,
      status: effectiveStatus(c, p, today),
      planEndsAt: p?.planEndsAt ?? null,
      plan: p?.plan ?? null,
      events: (p ? booked.get(p.id) ?? 0 : 0) + (evActs.get(c.id) ?? 0),
      lastActivityAt: lastAct.get(c.id) ?? null,
      openTasks: open.get(c.id) ?? 0,
      deal,
      stage: deal ? stages.get(deal.stageId) ?? null : null,
      organizationName: c.organizationId ? orgs.get(c.organizationId)?.name ?? null : c.company,
    };
  });
}

/* ---------- filtres ---------- */

export function matchFilter(r: ContactRow, f: ContactFilter, today: string): boolean {
  if (f.q) {
    const hay = normalize([r.name, r.email, r.phone, r.contact.company, r.contact.job, r.organizationName, r.contact.city, r.contact.instagram, r.contact.tags.join(" ")].filter(Boolean).join(" "));
    if (!normalize(f.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  if (f.status?.length && !f.status.includes(r.status)) return false;
  if (f.source?.length && !f.source.includes(r.contact.source)) return false;
  if (f.tags?.length && !f.tags.every((t) => r.contact.tags.includes(t))) return false;
  if (f.owner) {
    if (f.owner === "none" ? r.contact.ownerId !== null : r.contact.ownerId !== f.owner) return false;
  }
  if (f.consent !== undefined && r.contact.marketingConsent !== f.consent) return false;
  if (f.hasAccount !== undefined && !!r.profile !== f.hasAccount) return false;
  if (f.stage && r.deal?.stageId !== f.stage) return false;
  if (f.expiresWithin !== undefined) {
    if (r.status !== "adherente" || !r.planEndsAt) return false;
    const d = daysBetween(today, r.planEndsAt);
    if (d < 0 || d > f.expiresWithin) return false;
  }
  if (f.lapsedYear !== undefined) {
    if (r.status !== "ancienne") return false;
    if (r.planEndsAt ? Number(r.planEndsAt.slice(0, 4)) !== f.lapsedYear : !r.contact.tags.includes(`membre-${f.lapsedYear}`)) return false;
  }
  if (f.eventNoMembership && (r.events === 0 || r.status === "adherente" || r.status === "equipe")) return false;
  if (f.quietDays !== undefined) {
    if (r.lastActivityAt && daysBetween(ymdOf(r.lastActivityAt), today) < f.quietDays) return false;
  }
  return true;
}

export function filterRows(rows: ContactRow[], f: ContactFilter, today: string): ContactRow[] {
  return rows.filter((r) => matchFilter(r, f, today));
}

const isSource = (v: string): v is ContactSource => (CONTACT_SOURCES as readonly string[]).includes(v);
const isStatus = (v: string): v is ContactStatus => (CONTACT_STATUSES as readonly string[]).includes(v);
const int = (v: string | undefined, min: number, max: number) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []).map((s) => s.trim()).filter(Boolean);

/** Filtres lus depuis l'adresse (?status=prospect,ancienne&source=instagram&exp=30…). Toute valeur inconnue est ignorée. */
export function filterFromParams(sp: Params): ContactFilter {
  const f: ContactFilter = {};
  const q = first(sp.q)?.trim();
  if (q) f.q = q.slice(0, 120);
  const status = list(sp.status).filter(isStatus);
  if (status.length) f.status = status;
  const source = list(sp.source).filter(isSource);
  if (source.length) f.source = source;
  const tags = list(sp.tag).map((t) => t.slice(0, 40));
  if (tags.length) f.tags = tags;
  const owner = first(sp.owner);
  if (owner) f.owner = owner.slice(0, 64);
  const consent = first(sp.consent);
  if (consent === "1" || consent === "0") f.consent = consent === "1";
  const account = first(sp.account);
  if (account === "1" || account === "0") f.hasAccount = account === "1";
  const stage = first(sp.stage);
  if (stage) f.stage = stage.slice(0, 64);
  const exp = int(first(sp.exp), 0, 400);
  if (exp !== undefined) f.expiresWithin = exp;
  const lapsed = int(first(sp.lapsed), 2015, 2100);
  if (lapsed !== undefined) f.lapsedYear = lapsed;
  if (first(sp.evt) === "1") f.eventNoMembership = true;
  const quiet = int(first(sp.quiet), 1, 3650);
  if (quiet !== undefined) f.quietDays = quiet;
  return f;
}

/** Filtres → paramètres d'adresse (inverse de filterFromParams). */
export function filterToQuery(f: ContactFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status?.length) p.set("status", f.status.join(","));
  if (f.source?.length) p.set("source", f.source.join(","));
  if (f.tags?.length) p.set("tag", f.tags.join(","));
  if (f.owner) p.set("owner", f.owner);
  if (f.consent !== undefined) p.set("consent", f.consent ? "1" : "0");
  if (f.hasAccount !== undefined) p.set("account", f.hasAccount ? "1" : "0");
  if (f.stage) p.set("stage", f.stage);
  if (f.expiresWithin !== undefined) p.set("exp", String(f.expiresWithin));
  if (f.lapsedYear !== undefined) p.set("lapsed", String(f.lapsedYear));
  if (f.eventNoMembership) p.set("evt", "1");
  if (f.quietDays !== undefined) p.set("quiet", String(f.quietDays));
  return p.toString();
}

/** Nettoie des filtres venus d'ailleurs (JSON d'un segment, formulaire). */
export function sanitizeFilter(raw: unknown): ContactFilter {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const asParams: Params = {};
  const put = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return;
    asParams[k] = Array.isArray(v) ? v.map(String) : typeof v === "boolean" ? (v ? "1" : "0") : String(v);
  };
  put("q", o.q);
  put("status", o.status);
  put("source", o.source);
  put("tag", o.tags);
  put("owner", o.owner);
  put("consent", o.consent);
  put("account", o.hasAccount);
  put("stage", o.stage);
  put("exp", o.expiresWithin);
  put("lapsed", o.lapsedYear);
  if (o.eventNoMembership === true) asParams.evt = "1";
  put("quiet", o.quietDays);
  return filterFromParams(asParams);
}

export function isEmptyFilter(f: ContactFilter): boolean {
  return Object.keys(f).length === 0;
}

/** Description lisible d'un jeu de filtres (« Prospects · Instagram · expire dans 30 j »). */
export function describeFilter(f: ContactFilter, labels: { owner: (id: string) => string; stage: (id: string) => string; status: (s: ContactStatus) => string; source: (s: ContactSource) => string }): string[] {
  const out: string[] = [];
  if (f.status?.length) out.push(f.status.map(labels.status).join(" ou "));
  if (f.source?.length) out.push("source " + f.source.map(labels.source).join(" ou "));
  if (f.tags?.length) out.push(f.tags.map((t) => `#${t}`).join(" "));
  if (f.owner) out.push(f.owner === "none" ? "sans responsable" : `suivi par ${labels.owner(f.owner)}`);
  if (f.consent !== undefined) out.push(f.consent ? "accepte les messages" : "sans consentement");
  if (f.hasAccount !== undefined) out.push(f.hasAccount ? "avec compte" : "sans compte");
  if (f.stage) out.push(`étape « ${labels.stage(f.stage)} »`);
  if (f.expiresWithin !== undefined) out.push(`adhésion qui expire dans ${f.expiresWithin} j`);
  if (f.lapsedYear !== undefined) out.push(`anciennes membres ${f.lapsedYear}`);
  if (f.eventNoMembership) out.push("venues à un événement sans adhérer");
  if (f.quietDays !== undefined) out.push(`sans échange depuis ${f.quietDays} j`);
  if (f.q) out.push(`« ${f.q} »`);
  return out;
}

/* ---------- doublons ---------- */

const digits = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-9);

/** Groupes de fiches qui se ressemblent (même e-mail, même téléphone ou même nom). */
export function findDuplicates(rows: ContactRow[]): Array<{ reason: string; rows: ContactRow[] }> {
  const groups = new Map<string, { reason: string; rows: ContactRow[] }>();
  const add = (key: string, reason: string, r: ContactRow) => {
    const g = groups.get(key) ?? { reason, rows: [] };
    if (!g.rows.includes(r)) g.rows.push(r);
    groups.set(key, g);
  };
  for (const r of rows) {
    if (r.email) add("e:" + r.email.trim().toLowerCase(), "même e-mail", r);
    if (digits(r.phone).length >= 8) add("p:" + digits(r.phone), "même téléphone", r);
    const n = normalize(r.name);
    if (n && n !== "sans nom" && n.includes(" ")) add("n:" + n, "même nom", r);
  }
  const seen = new Set<string>();
  const out: Array<{ reason: string; rows: ContactRow[] }> = [];
  for (const g of groups.values()) {
    if (g.rows.length < 2) continue;
    // deux comptes différents ne sont pas des doublons fusionnables
    if (g.rows.filter((r) => r.profile).length > 1) continue;
    const key = g.rows.map((r) => r.contact.id).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

/** La fiche importée ressemble-t-elle à une fiche existante ? (même e-mail ou même téléphone) */
export function existingMatch(rows: ContactRow[], email: string | null, phone: string | null): ContactRow | null {
  const e = email?.trim().toLowerCase();
  const p = digits(phone);
  return rows.find((r) => (e && r.email?.trim().toLowerCase() === e) || (p.length >= 8 && digits(r.phone) === p)) ?? null;
}

/* ---------- tâches ---------- */

export type TaskBuckets = { overdue: Task[]; today: Task[]; upcoming: Task[]; done: Task[] };

export function taskBuckets(tasks: Task[], today: string, ownerId?: string | null): TaskBuckets {
  const mine = ownerId === undefined ? tasks : tasks.filter((t) => t.ownerId === ownerId);
  const byDue = (a: Task, b: Task) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.createdAt < b.createdAt ? -1 : 1);
  const open = mine.filter((t) => !t.doneAt).sort(byDue);
  return {
    overdue: open.filter((t) => t.dueOn < today),
    today: open.filter((t) => t.dueOn === today),
    upcoming: open.filter((t) => t.dueOn > today),
    done: mine.filter((t) => t.doneAt).sort((a, b) => (a.doneAt! < b.doneAt! ? 1 : -1)),
  };
}

/** Tâches à rappeler à leur responsable (échues ou du jour, ouvertes, pas encore rappelées). */
export function tasksToRemind(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => !t.doneAt && !t.remindedAt && t.ownerId && t.dueOn <= today);
}

export function dueLabel(dueOn: string, today: string): string {
  const d = daysBetween(today, dueOn);
  if (d === 0) return "aujourd’hui";
  if (d === 1) return "demain";
  if (d === -1) return "hier";
  if (d < 0) return `en retard de ${-d} j`;
  return d < 7 ? `dans ${d} j` : `le ${dueOn.slice(8, 10)}/${dueOn.slice(5, 7)}`;
}

export const QUICK_DUES: Array<{ label: string; days: number }> = [
  { label: "Aujourd’hui", days: 0 },
  { label: "Demain", days: 1 },
  { label: "Dans 3 jours", days: 3 },
  { label: "Dans une semaine", days: 7 },
];
export const quickDue = (today: string, days: number) => addDays(today, days);

/* ---------- messages préparés (aucun envoi automatique) ---------- */

export function fillTemplate(text: string, r: Pick<ContactRow, "name" | "contact">): string {
  const prenom = r.contact.firstName || r.name.split(" ")[0] || "";
  return text.replace(/\{prenom\}/gi, prenom).replace(/\{nom\}/gi, r.name);
}

/** Lien WhatsApp (wa.me) avec le message prérempli ; null sans numéro exploitable. */
export function whatsappLink(phone: string | null, text: string): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 10) d = "212" + d.slice(1); // numéro marocain local
  if (d.length < 8) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Tags existants, triés par fréquence. */
export function allTags(contacts: Contact[]): string[] {
  const n = new Map<string, number>();
  contacts.forEach((c) => c.tags.forEach((t) => n.set(t, (n.get(t) ?? 0) + 1)));
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([t]) => t);
}

export function normalizeTag(t: string): string {
  return t
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}
