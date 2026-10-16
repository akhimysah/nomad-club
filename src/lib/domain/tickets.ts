import { randomInt } from "node:crypto";
import { TZ } from "../clock";

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Code de billet « NC-2610-K7QD » : jour et mois du rendez-vous + 4 caractères aléatoires. */
export function newTicketCode(startsAt: string): string {
  const d = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit" }).format(d);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "2-digit" }).format(d);
  let s = "";
  for (let i = 0; i < 4; i++) s += CHARS[randomInt(CHARS.length)];
  return `NC-${day}${month}-${s}`;
}

export function isTicketCode(code: string): boolean {
  return /^NC-\d{4}-[A-Z0-9]{4}$/.test(code);
}
