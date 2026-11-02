/** Petites aides côté serveur pour préparer les données des pages. */
import type { CheckoutEvent, PayEnv } from "@/components/events/CheckoutSheet";
import type { Mine } from "@/components/events/EventBits";
import type { TicketData } from "@/components/ui/Ticket";
import { daysBetween, today, ymdOf } from "./clock";
import { PRICES } from "./content";
import { getRepo } from "./data";
import { paymentMode, transferDetails } from "./env";
import { dayShort, fullName, hour, money, timeRange, ymdDots, ymdLong } from "./format";
import { qrData } from "./qr";
import { siteUrl } from "./site";
import type { BookingView, EventView, PaidPlan, Payment, Profile, Viewer } from "./types";
import { hasRole } from "./permissions";
import { paymentInstallmentChoices } from "./modules/paiements/views"; // --- Vague 2 · paiements ---

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
    installments: paymentInstallmentChoices(), // --- Vague 2 · paiements ---
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
  const active = dir.filter((p) => hasRole(p, "member") && p.plan !== "free" && p.planEndsAt && p.planEndsAt >= t);
  return { total: active.length, premium: active.filter((p) => p.plan === "premium").length };
}

/** État de l'adhésion d'une personne (accueil et « Moi »). */
export async function membershipState(p: Profile) {
  const t = today();
  const payments = await getRepo().listPaymentsForProfile(p.id);
  const recent = (x: Payment) => !!x.validatedAt && daysBetween(ymdOf(x.validatedAt), t) <= 30;
  const pending = payments.some((x) => x.kind === "membership" && x.status === "declared" && x.method === "transfer");
  const renewed = payments.some((x) => x.kind === "membership" && x.status === "validated" && x.membershipAction === "renew" && recent(x));
  const days = p.planEndsAt ? Math.max(0, daysBetween(t, p.planEndsAt)) : 0;
  const premium = p.plan === "premium";
  return {
    premium,
    plan: (premium ? "premium" : "member") as PaidPlan,
    price: premium ? PRICES.premium : PRICES.member,
    days,
    expired: !p.planEndsAt || p.planEndsAt < t,
    endsLong: p.planEndsAt ? ymdLong(p.planEndsAt) : "",
    endsDots: p.planEndsAt ? ymdDots(p.planEndsAt) : "",
    renewed,
    pending,
    canRenew: !renewed && !pending && days <= 90,
  };
}
export type MembershipState = Awaited<ReturnType<typeof membershipState>>;

/** Prochaine réservation confirmée ou en attente de paiement. */
export function nextBookingOf(bookings: BookingView[]): BookingView | null {
  const t = today();
  return bookings.filter((b) => ["paid", "offered", "pending"].includes(b.status) && ymdOf(b.event.startsAt) >= t).sort((a, b) => (a.event.startsAt < b.event.startsAt ? -1 : 1))[0] ?? null;
}
