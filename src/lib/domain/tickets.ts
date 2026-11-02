import { randomInt } from "node:crypto";
import { TZ } from "../clock";

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Code de billet « NC-2610-K7QD9X » : jour et mois du rendez-vous + 6 caractères aléatoires
 * (Lot 6 : 6 au lieu de 4, contre l'énumération ; les anciens codes à 4 caractères restent valides).
 */
export function newTicketCode(startsAt: string): string {
  const d = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit" }).format(d);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "2-digit" }).format(d);
  let s = "";
  for (let i = 0; i < 6; i++) s += CHARS[randomInt(CHARS.length)];
  return `NC-${day}${month}-${s}`;
}

export function isTicketCode(code: string): boolean {
  return /^NC-\d{4}-[A-Z0-9]{4}([A-Z0-9]{2})?$/.test(code);
}
