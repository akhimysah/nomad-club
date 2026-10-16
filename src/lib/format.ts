import { TZ, daysBetween, ymdInTz } from "./clock";

const NBSP = " ";

/** 1250 -> « 1 250 $ » */
export function money(n: number): string {
  return num(n) + NBSP + "$";
}

export function num(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function partsOf(iso: string | number) {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  const f = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
    day: Number(get("day")),
    month: get("month"),
    year: Number(get("year")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const LONG_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const SHORT_DAYS: Record<string, string> = {
  lundi: "lun.",
  mardi: "mar.",
  mercredi: "mer.",
  jeudi: "jeu.",
  vendredi: "ven.",
  samedi: "sam.",
  dimanche: "dim.",
};

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayNum(d: number): string {
  return d === 1 ? "1er" : String(d);
}

/** « Lundi 26 octobre » */
export function dayLong(iso: string): string {
  const p = partsOf(iso);
  return `${cap(p.weekday)} ${dayNum(p.day)} ${p.month}`;
}

/** « lun. 26 oct. » */
export function dayShort(iso: string): string {
  const p = partsOf(iso);
  return `${SHORT_DAYS[p.weekday] ?? p.weekday} ${dayNum(p.day)} ${monthShortOf(iso)}`;
}

export function dayNumber(iso: string): number {
  return partsOf(iso).day;
}

export function monthShortOf(iso: string): string {
  const ymd = ymdInTz(Date.parse(iso));
  return SHORT_MONTHS[Number(ymd.slice(5, 7)) - 1];
}

/** « 26 oct. » */
export function dayMonthShort(iso: string): string {
  return `${dayNumber(iso)} ${monthShortOf(iso)}`;
}

/** « 12 h », « 9 h 30 » */
export function hour(iso: string): string {
  const p = partsOf(iso);
  return p.minute ? `${p.hour} h ${String(p.minute).padStart(2, "0")}` : `${p.hour} h`;
}

/** « 12 h – 15 h » */
export function timeRange(start: string, end: string | null): string {
  return end ? `${hour(start)} – ${hour(end)}` : hour(start);
}

/** AAAA-MM-JJ -> « 18 novembre 2026 » */
export function ymdLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${dayNum(d)} ${LONG_MONTHS[m - 1]} ${y}`;
}

/** AAAA-MM-JJ -> « 18 nov. 2026 » */
export function ymdShortYear(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${dayNum(d)} ${SHORT_MONTHS[m - 1]} ${y}`;
}

/** AAAA-MM-JJ -> « 18 nov. » */
export function ymdShort(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${dayNum(d)} ${SHORT_MONTHS[m - 1]}`;
}

/** AAAA-MM-JJ -> « 18.11.2026 » */
export function ymdDots(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

export function monthShortName(monthIndex0: number): string {
  return SHORT_MONTHS[monthIndex0];
}

export function monthLongName(monthIndex0: number): string {
  return LONG_MONTHS[monthIndex0];
}

/** Date du jour en tête de page : « Mercredi 14 octobre 2026 » */
export function todayLong(ms: number, withYear = true): string {
  const p = partsOf(ms);
  return `${cap(p.weekday)} ${dayNum(p.day)} ${p.month}${withYear ? " " + p.year : ""}`;
}

/** Heure d'un message : « 9 h 52 », « Hier », « Lundi », « 12 oct. » */
export function messageTime(iso: string, nowMsValue: number): string {
  const d = ymdInTz(Date.parse(iso));
  const t = ymdInTz(nowMsValue);
  const diff = daysBetween(d, t);
  if (diff <= 0) return hour(iso);
  if (diff === 1) return "Hier";
  if (diff < 7) return cap(partsOf(iso).weekday);
  return dayMonthShort(iso);
}

export function placesText(n: number): string {
  if (n <= 0) return "Complet";
  return n === 1 ? "1 place restante" : `${n} places restantes`;
}

export function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export const PLAN_LABEL = { free: "Compte gratuit", member: "Membre", premium: "Premium" } as const;
