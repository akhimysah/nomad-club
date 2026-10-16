import { isRealMode } from "./env";

/** Fuseau du club. */
export const TZ = "Africa/Casablanca";

/**
 * En démo, l'horloge démarre au mercredi 14 octobre 2026, 10 h 12 (heure de Marrakech)
 * et avance en temps réel : les données d'exemple restent cohérentes.
 */
export const DEMO_START = Date.parse("2026-10-14T10:12:00+01:00");
const processStart = Date.now();

export function nowMs(): number {
  if (isRealMode()) return Date.now();
  return DEMO_START + (Date.now() - processStart);
}

export function now(): Date {
  return new Date(nowMs());
}

export function nowIso(): string {
  return now().toISOString();
}

/** Jour courant à Marrakech, AAAA-MM-JJ. */
export function today(): string {
  return ymdInTz(nowMs());
}

export function ymdInTz(ms: number): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
  return p; // en-CA => AAAA-MM-JJ
}

/** Nombre de jours entre deux dates AAAA-MM-JJ (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function addYears(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y + n}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Jour (AAAA-MM-JJ, Marrakech) d'un instant ISO. */
export function ymdOf(iso: string): string {
  return ymdInTz(Date.parse(iso));
}

function tzOffsetMinutes(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(ms);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return Math.round((asUtc - ms) / 60000);
}

/** Instant ISO d'une date (AAAA-MM-JJ) et d'une heure (HH:MM) locales à Marrakech. */
export function zonedIso(ymd: string, hm: string): string {
  const guess = Date.parse(`${ymd}T${hm}:00Z`);
  return new Date(guess - tzOffsetMinutes(guess) * 60000).toISOString();
}

/** Heure locale (HH:MM) d'un instant ISO à Marrakech. */
export function hmOf(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(Date.parse(iso));
}
