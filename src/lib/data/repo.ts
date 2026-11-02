/**
 * Interface unique d'accès aux données. Les pages et les server actions ne passent que par elle.
 * Deux implémentations : demo-repo.ts (mémoire) et supabase-repo.ts (Postgres).
 */
import type { Snapshot } from "../domain/founders";
// --- Lot 5 ---
import type { CrmRepo } from "../modules/crm/repo";
import type { EngagementRepo } from "../modules/engagement/repo"; // --- Lot 4 ---
import type {
  AppNotification,
  AuditAction,
  AuditEntry,
  Booking,
  BookingView,
  ClubEvent,
  DmThread,
  EventView,
  GrantableRole,
  Memory,
  Message,
  MessageView,
  MembershipAction,
  NotificationChannel,
  NotificationPref,
  NotificationType,
  Organization,
  OrganizationKind,
  OrganizationMember,
  OrganizationMemberRole,
  PaidPlan,
  PartnerOffer,
  Payment,
  PayMethod,
  Place,
  Profile,
  ProgramStep,
} from "../types";
// --- Lot 3 ---
import type { PartenairesRepo } from "../modules/partenaires/repo";
import type { SecuriteRepo } from "../modules/securite/repo"; // --- Lot 6 ---

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

export type CancelResult = {
  /** Rendez-vous concerné (null si la réservation n'existe pas ou n'était pas à soi). */
  eventId: string | null;
  /** Première personne (avec compte) de la liste d'attente quand une place vient de se libérer. */
  waitlistProfileId: string | null;
};

export type AuditInput = {
  actorId: string | null;
  action: AuditAction;
  targetType: AuditEntry["targetType"];
  targetId: string | null;
  summary: string;
  details?: Record<string, unknown>;
};

export type NotificationInput = {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
};

export type MyOrganization = { organization: Organization; role: OrganizationMemberRole };
export type OrganizationMemberView = OrganizationMember & { profile: Profile | null };

import type { CommunauteRepo } from "../modules/communaute/repo"; // --- Lot 1 ---

export interface Repo extends CommunauteRepo /* Lot 1 */, PartenairesRepo /* --- Lot 3 --- */, CrmRepo /* Lot 5 */, EngagementRepo /* --- Lot 4 --- */, SecuriteRepo /* --- Lot 6 --- */ {
  /* profils */
  getProfile(id: string): Promise<Profile | null>;
  /** Annuaire : adhérentes et fondatrices. */
  listDirectory(): Promise<Profile[]>;
  createGuestProfile(input: NewProfileInput): Promise<Profile>;
  /** Tous les profils (CRM, rôles) : administratrices uniquement en mode réel. */
  listProfiles(): Promise<Profile[]>;

  /* rôles (cumulables) */
  grantRole(profileId: string, role: GrantableRole, actorId: string): Promise<Profile>;
  revokeRole(profileId: string, role: GrantableRole, actorId: string): Promise<Profile>;

  /* organisations (partenaires, pros) */
  listOrganizations(opts?: { kind?: OrganizationKind }): Promise<Organization[]>;
  listMyOrganizations(profileId: string): Promise<MyOrganization[]>;
  listOrganizationMembers(organizationId: string): Promise<OrganizationMemberView[]>;

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
  /** Annule ; profileId null = annulation système (session Stripe expirée). */
  cancelBooking(bookingId: string, profileId: string | null): Promise<CancelResult>;
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
  /** Renvoie l'identifiant de la relance créée. */
  sendReminder(key: string, founderId: string): Promise<string | null>;

  /* journal des opérations */
  logAudit(entry: AuditInput): Promise<void>;
  listAudit(opts?: { limit?: number }): Promise<AuditEntry[]>;

  /* notifications in-app (+ préférences) */
  /** Crée les notifications (en ignorant celles que la destinataire a coupées). Renvoie le nombre créé. */
  createNotifications(rows: NotificationInput[]): Promise<number>;
  listNotifications(profileId: string, limit?: number): Promise<AppNotification[]>;
  countUnreadNotifications(profileId: string): Promise<number>;
  markNotificationsRead(profileId: string, ids: string[] | "all"): Promise<void>;
  /** Préférences enregistrées (les types absents sont actifs par défaut). */
  listNotificationPrefs(profileId: string): Promise<NotificationPref[]>;
  setNotificationPref(profileId: string, type: NotificationType, channel: NotificationChannel, enabled: boolean): Promise<void>;
}

export function dmChannel(a: string, b: string): string {
  return "dm:" + [a, b].sort().join(":");
}

export function otherInChannel(channel: string, me: string): string | null {
  if (!channel.startsWith("dm:")) return null;
  const [, a, b] = channel.split(":");
  return a === me ? b : b === me ? a : null;
}
