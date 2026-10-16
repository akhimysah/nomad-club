import type { Booking, ClubEvent, EventStats, EventView, Plan } from "../types";

export const TAKEN_STATUSES: ReadonlyArray<Booking["status"]> = ["pending", "paid", "offered"];

export function eventStats(event: ClubEvent, bookings: Booking[]): EventStats {
  let paid = 0;
  let pending = 0;
  let waitlist = 0;
  for (const b of bookings) {
    if (b.eventId !== event.id) continue;
    if (b.status === "paid" || b.status === "offered") paid++;
    else if (b.status === "pending") pending++;
    else if (b.status === "waitlist") waitlist++;
  }
  const taken = paid + pending;
  return { taken, paid, pending, waitlist, left: Math.max(0, event.capacity - taken) };
}

export function toEventView(event: ClubEvent, bookings: Booking[]): EventView {
  return { ...event, stats: eventStats(event, bookings) };
}

/**
 * Prix d'une place selon la formule.
 * null = la formule ne permet pas de réserver (rendez-vous Premium pour une non-Premium).
 */
export function priceFor(event: ClubEvent, plan: Plan): number | null {
  if (event.premiumFree) return plan === "premium" ? 0 : null;
  return plan === "free" ? event.pricePublic : event.priceMember;
}

/** « Lunch du 26 oct. » : premier mot du titre court. */
export function eventGroupLabel(event: ClubEvent, dayMonth: string): string {
  const word = (event.shortTitle || event.title).split(/\s+/)[0];
  return `${word} du ${dayMonth}`;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
