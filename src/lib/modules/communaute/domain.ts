/**
 * Lot 1 — Communauté : règles pures (sans accès aux données), partagées par les deux implémentations
 * du dépôt, les pages et les tests. Même logique que les fonctions SQL de 0004_communaute.sql.
 */
import type { ClubEvent, Profile } from "../../types";
import type { DirectoryEntry, DirectoryProfile, GroupIcon, KeywordAction, ModerationKeyword, ReactionKind } from "./types";

/* ---------- canaux de messagerie ---------- */

export const GROUP_PREFIX = "group:";
export const groupChannel = (groupId: string) => GROUP_PREFIX + groupId;
export const groupIdOfChannel = (channel: string): string | null => (channel.startsWith(GROUP_PREFIX) ? channel.slice(GROUP_PREFIX.length) : null);

/** Texte affiché à la place d'un message masqué. */
export const HIDDEN_LABEL = "Message masqué par la modération";
/** Texte stocké dans messages.body tant que le message est masqué (l'original est mis de côté). */
export const HIDDEN_BODY = "[masqué]";

/* ---------- mots-clés ---------- */

/**
 * Minuscules et sans accents (même règle que la fonction SQL nc_fold) :
 * « Arnaque », « ARNAQUÉ » et « arnaque » se valent.
 */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'");
}

export function normalizeKeyword(s: string): string {
  return s.trim().replace(/\s+/g, " ").slice(0, 60);
}

/** Mots-clés présents dans un message, le plus sévère d'abord (masquer avant signaler). */
export function matchKeywords(body: string, keywords: Pick<ModerationKeyword, "keyword" | "action">[]): Array<{ keyword: string; action: KeywordAction }> {
  const text = fold(body);
  return keywords
    .filter((k) => k.keyword.trim() && text.includes(fold(k.keyword.trim())))
    .map((k) => ({ keyword: k.keyword, action: k.action }))
    .sort((a, b) => (a.action === b.action ? 0 : a.action === "hide" ? -1 : 1));
}

export const KEYWORD_ACTION_LABEL: Record<KeywordAction, string> = {
  hide: "Masquer et signaler",
  flag: "Signaler seulement",
};

/* ---------- actualités ---------- */

export const REACTION_LABEL: Record<ReactionKind, { label: string; sign: string }> = {
  like: { label: "J’aime", sign: "♡" },
  bravo: { label: "Bravo", sign: "✦" },
  merci: { label: "Merci", sign: "✓" },
};

/** Photos du club proposées pour illustrer une publication. */
export const CLUB_PHOTOS: Array<{ src: string; label: string }> = [
  { src: "/img/lunch-fer7.jpg", label: "Lunch au Fer7" },
  { src: "/img/saison-la-terraza.jpg", label: "La Terraza" },
  { src: "/img/chill-connect-groupe.jpg", label: "Chill & Connect" },
  { src: "/img/diner-terrajana.jpg", label: "Terrajana" },
  { src: "/img/padel.jpg", label: "Padel" },
  { src: "/img/iftar-villa-yemna.jpg", label: "Iftar, Villa Yemna" },
  { src: "/img/chonchon-chocolat.jpg", label: "Chonchon & Chocolat" },
  { src: "/img/brunch-prise-de-parole.jpg", label: "Brunch" },
  { src: "/img/body-agency.jpg", label: "Body Agency" },
];

/** Image acceptée : photo du club, image importée (JPEG/PNG/WebP en data URL, 1,5 Mo max) ou adresse https. */
export function isAcceptableImage(src: string): boolean {
  if (/^\/img\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(src)) return true;
  if (/^https:\/\/[^\s"'<>]+$/i.test(src) && src.length <= 500) return true;
  return /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(src) && src.length <= 1_500_000;
}

/* ---------- groupes ---------- */

export const GROUP_ICON_LABEL: Record<GroupIcon, string> = {
  users: "Cercle",
  book: "Lecture",
  heart: "Bien-être",
  spark: "Idées",
  star: "Talents",
  globe: "International",
  home: "Famille",
  chat: "Discussion",
  crown: "Premium",
  gift: "Bons plans",
  pin: "Quartier",
  cal: "Sorties",
};

export function slugifyGroup(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/* ---------- annuaire ---------- */

export const SECTORS = [
  "Communication et marketing",
  "Conseil et stratégie",
  "Droit et finance",
  "Architecture et design",
  "Art, photo et création",
  "Mode, beauté et bijoux",
  "Bien-être et sport",
  "Santé",
  "Hôtellerie et restauration",
  "Tech et digital",
  "Éducation et famille",
  "Événementiel et voyage",
] as const;

export const VISIBILITY_LABEL = {
  all: { label: "Visible par toutes les membres", hint: "Ta fiche complète apparaît dans l’annuaire." },
  basic: { label: "Seulement mon nom et mon métier", hint: "Le reste de ta fiche reste privé." },
  hidden: { label: "Masquée", hint: "Tu n’apparais pas dans l’annuaire (les fondatrices te voient toujours)." },
} as const;

export function emptyDirectoryProfile(profileId: string, at: string): DirectoryProfile {
  return {
    profileId,
    company: null,
    sector: null,
    skills: [],
    instagram: null,
    linkedin: null,
    website: null,
    lookingFor: null,
    offering: null,
    visibility: "all",
    showWhatsapp: false,
    showEmail: false,
    updatedAt: at,
  };
}

/**
 * Fiche d'annuaire vue par une autre membre (même règle que la fonction SQL directory_list) :
 * masquée → absente ; « nom et métier » → le reste est vide ; WhatsApp et e-mail seulement si la membre l'a choisi.
 * `self` ou `admin` : tout est visible.
 */
export function toDirectoryEntry(p: Profile, d: DirectoryProfile | null, opts: { self: boolean; admin: boolean; founder: boolean }): DirectoryEntry | null {
  const dp = d ?? emptyDirectoryProfile(p.id, p.createdAt);
  const full = opts.self || opts.admin;
  if (dp.visibility === "hidden" && !full) return null;
  const limited = dp.visibility === "basic" && !full;
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const badge = opts.founder ? "Fondatrice" : p.plan === "premium" ? "Premium" : null;
  if (limited) {
    return {
      id: p.id, firstName: p.firstName, lastName: p.lastName, name, job: p.job, limited: true, photo: null, company: null, sector: null, nationality: null,
      marrakechSince: null, bio: null, skills: [], instagram: null, linkedin: null, website: null, lookingFor: null, offering: null, whatsapp: null, email: null, badge,
    };
  }
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    name,
    job: p.job,
    limited: false,
    photo: p.avatarUrl,
    company: dp.company,
    sector: dp.sector,
    nationality: p.country,
    marrakechSince: p.marrakechSince,
    bio: p.bio,
    skills: dp.skills,
    instagram: dp.instagram,
    linkedin: dp.linkedin,
    website: dp.website,
    lookingFor: dp.lookingFor,
    offering: dp.offering,
    whatsapp: full || dp.showWhatsapp ? p.whatsapp : null,
    email: full || dp.showEmail ? p.email : null,
    badge,
  };
}

/** Compétences saisies « a, b ; c » → liste propre, sans doublons, 12 au plus. */
export function parseSkills(raw: string): string[] {
  const out: string[] = [];
  for (const s of raw.split(/[,;\n]/)) {
    const t = s.trim().replace(/\s+/g, " ").slice(0, 40);
    if (t && !out.some((x) => fold(x) === fold(t))) out.push(t);
  }
  return out.slice(0, 12);
}

/* ---------- calendrier ---------- */

export type MonthCell = { ymd: string; day: number; inMonth: boolean };

/** Grille du mois (semaines du lundi au dimanche) pour AAAA-MM. */
export function monthGrid(ym: string): MonthCell[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
  const start = Date.UTC(y, m - 1, 1 - offset);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const cells: MonthCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start + i * 86400000);
    cells.push({ ymd: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1 });
  }
  return cells;
}

export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const isYearMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isYmd = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------- fichier .ics ---------- */

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plie les lignes à 75 octets (RFC 5545). */
function fold75(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 74) {
      out.push(cur);
      cur = " ";
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** Fichier iCalendar d'un rendez-vous (Apple Calendrier, Google Agenda, Outlook). */
export function eventIcs(e: Pick<ClubEvent, "id" | "slug" | "title" | "startsAt" | "endsAt" | "venue" | "address" | "description">, url: string, stampIso: string): string {
  const end = e.endsAt ?? new Date(Date.parse(e.startsAt) + 2 * 3600000).toISOString();
  const location = [e.venue, e.address].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nomad Club//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@nomadclub`,
    `DTSTAMP:${icsDate(stampIso)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`${e.title} · Nomad Club`)}`,
    location ? `LOCATION:${icsText(location)}` : "",
    `DESCRIPTION:${icsText(`${e.description}\n\n${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`Demain : ${e.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold75).join("\r\n") + "\r\n";
}
