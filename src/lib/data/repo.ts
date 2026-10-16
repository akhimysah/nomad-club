/**
 * Interface unique d'accès aux données. Les pages et les server actions ne passent que par elle.
 * Deux implémentations : demo-repo.ts (mémoire) et supabase-repo.ts (Postgres).
 */
import type { Snapshot } from "../domain/founders";
import type {
  Booking,
  BookingView,
  ClubEvent,
  DmThread,
  EventView,
  Memory,
  Message,
  MessageView,
  MembershipAction,
  PaidPlan,
  PartnerOffer,
  Payment,
  PayMethod,
  Place,
  Profile,
  ProgramStep,
} from "../types";

export type EventInput = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  placeId: string | null;
  venue: string | null;
  address: string | null;
  capacity: number;
  pricePublic: number;
  priceMember: number;
  premiumFree: boolean;
  description: string;
  program: ProgramStep[];
};

export type BookInput = {
  eventId: string;
  profileId: string | null;
  guestFirstName: string | null;
  guestWhatsapp: string | null;
  /** Montant calculé côté serveur selon la formule. */
  amount: number;
  method: PayMethod;
  /** paid : paiement confirmé (démo, gratuit) ; pending : en attente (Stripe, virement). */
  initialStatus: "paid" | "offered" | "pending";
  /** Virement déclaré : crée aussi un paiement « declared ». */
  declareTransfer: boolean;
  /** Si complet : inscrire sur la liste d'attente plutôt qu'échouer. */
  waitlistIfFull: boolean;
};

export type BookResult =
  | { status: "booked"; booking: Booking }
  | { status: "waitlist"; booking: Booking; position: number }
  | { status: "already"; booking: Booking }
  | { status: "full" };

export type MembershipInput = {
  profileId: string;
  payerName: string;
  action: MembershipAction;
  plan: PaidPlan;
  amount: number;
  method: PayMethod;
  /** validated : appliqué tout de suite (démo, Stripe confirmé) ; declared : virement à valider. */
  status: "validated" | "declared";
  stripeSessionId?: string | null;
};

export type NewProfileInput = {
  firstName: string;
  lastName: string;
  whatsapp: string | null;
  email: string | null;
};

export interface Repo {
  /* profils */
  getProfile(id: string): Promise<Profile | null>;
  /** Annuaire : adhérentes et fondatrices. */
  listDirectory(): Promise<Profile[]>;
  createGuestProfile(input: NewProfileInput): Promise<Profile>;

  /* contenus */
  listPlaces(): Promise<Place[]>;
  listMemories(): Promise<Memory[]>;
  listPartnerOffers(): Promise<PartnerOffer[]>;

  /* rendez-vous */
  listEvents(opts?: { status?: ClubEvent["status"] | "all"; fromYmd?: string }): Promise<EventView[]>;
  getEventBySlug(slug: string): Promise<EventView | null>;
  getEventById(id: string): Promise<EventView | null>;
  createEvent(input: EventInput, status: "draft" | "published"): Promise<ClubEvent>;
  updateEvent(id: string, input: Partial<EventInput>): Promise<ClubEvent>;
  /** Refuse si le lieu n'est pas renseigné. */
  publishEvent(id: string): Promise<ClubEvent>;

  /* réservations */
  bookEvent(input: BookInput): Promise<BookResult>;
  getBookingByCode(code: string): Promise<BookingView | null>;
  listBookingsByCodes(codes: string[]): Promise<BookingView[]>;
  listBookingsForProfile(profileId: string): Promise<BookingView[]>;
  cancelBooking(bookingId: string, profileId: string | null): Promise<void>;
  setBookingStripeSession(bookingId: string, sessionId: string): Promise<void>;

  /* adhésions et paiements */
  recordMembership(input: MembershipInput): Promise<Payment>;
  setPaymentStripeSession(paymentId: string, sessionId: string): Promise<void>;
  listPaymentsForProfile(profileId: string): Promise<Payment[]>;
  /** Paiement Stripe confirmé par le webhook (réservation ou adhésion). */
  markStripeSessionPaid(sessionId: string, meta: { kind: "booking" | "membership"; id: string }): Promise<void>;

  /* salon et messages */
  listMessages(channel: string, limit?: number): Promise<MessageView[]>;
  postMessage(channel: string, authorId: string, body: string): Promise<Message>;
  listDmThreads(profileId: string): Promise<DmThread[]>;
  markDmRead(profileId: string, otherId: string): Promise<void>;
  countUnreadDms(profileId: string): Promise<number>;

  /* fondatrices */
  snapshot(): Promise<Snapshot>;
  validatePayment(paymentId: string, founderId: string): Promise<Payment | null>;
  /** Clé issue du tableau de bord : renew:<id>, lapsed:<id>, unpaid:<id>, free:<id>. */
  sendReminder(key: string, founderId: string): Promise<void>;
}

export function dmChannel(a: string, b: string): string {
  return "dm:" + [a, b].sort().join(":");
}

export function otherInChannel(channel: string, me: string): string | null {
  if (!channel.startsWith("dm:")) return null;
  const [, a, b] = channel.split(":");
  return a === me ? b : b === me ? a : null;
}
