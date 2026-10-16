/** Petites aides côté serveur pour préparer les données des pages. */
import type { CheckoutEvent, PayEnv } from "@/components/events/CheckoutSheet";
import type { Mine } from "@/components/events/EventBits";
import type { TicketData } from "@/components/ui/Ticket";
import { today } from "./clock";
import { getRepo } from "./data";
import { paymentMode, transferDetails } from "./env";
import { dayShort, fullName, hour, money, timeRange } from "./format";
import { qrData } from "./qr";
import { siteUrl } from "./site";
import type { BookingView, EventView, Viewer } from "./types";

/** Réservations de la personne qui regarde (compte ou billets sans compte). */
export async function viewerBookings(v: Viewer): Promise<BookingView[]> {
  const repo = getRepo();
  if (v.profile) return repo.listBookingsForProfile(v.profile.id);
  if (v.guestTickets.length) return repo.listBookingsByCodes(v.guestTickets);
  return [];
}

export function mineByEvent(bookings: BookingView[]): Map<string, Mine> {
  const m = new Map<string, Mine>();
  for (const b of bookings) {
    if (b.status === "waitlist") {
      if (!m.has(b.eventId)) m.set(b.eventId, "waitlist");
    } else if (b.status !== "cancelled") m.set(b.eventId, "booked");
  }
  return m;
}

export async function ticketData(b: BookingView): Promise<TicketData> {
  const base = await siteUrl();
  return {
    title: b.event.title,
    image: b.event.image,
    imagePosition: b.event.imagePosition,
    dateShort: dayShort(b.event.startsAt),
    time: hour(b.event.startsAt),
    venue: b.event.venue ?? "À confirmer",
    price: b.amount ? money(b.amount) : "Offert",
    holder: b.holderName,
    code: b.ticketCode,
    qr: qrData(`${base}/billet/${b.ticketCode}`),
  };
}

/** Contexte de paiement transmis aux tunnels de réservation et d'adhésion. */
export function payEnv(v: Viewer): PayEnv {
  return {
    mode: paymentMode(),
    transfer: transferDetails(),
    me: v.profile ? { firstName: v.profile.firstName, fullName: fullName(v.profile), phone: v.profile.whatsapp } : null,
  };
}

/** Résumé d'un rendez-vous pour le tunnel de paiement. */
export function checkoutEvent(ev: EventView): CheckoutEvent {
  return {
    id: ev.id,
    title: ev.title,
    image: ev.image,
    imagePosition: ev.imagePosition,
    imageZoom: ev.imageZoom,
    line: `${dayShort(ev.startsAt)} · ${timeRange(ev.startsAt, ev.endsAt)} · ${ev.venue ?? "lieu à confirmer"}`,
    priceMember: ev.priceMember,
  };
}

/** Rendez-vous publiés à venir, avec l'état de la personne pour chacun. */
export async function upcomingFor(v: Viewer) {
  const repo = getRepo();
  const [events, bookings] = await Promise.all([repo.listEvents({ status: "published", fromYmd: today() }), viewerBookings(v)]);
  return { events, bookings, mine: mineByEvent(bookings) };
}

/** Le rendez-vous « à la une » : celui marqué featured, sinon le premier à venir. */
export function featuredOf(events: EventView[]): EventView | null {
  return events.find((e) => e.featured) ?? events[0] ?? null;
}

/** Adhérentes actives (pour « 61 adhérentes »). */
export async function activeMemberCount(): Promise<{ total: number; premium: number }> {
  const t = today();
  const dir = await getRepo().listDirectory();
  const active = dir.filter((p) => p.role === "member" && p.plan !== "free" && p.planEndsAt && p.planEndsAt >= t);
  return { total: active.length, premium: active.filter((p) => p.plan === "premium").length };
}
