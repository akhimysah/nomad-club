/**
 * Types du domaine Nomad Club.
 * Ils reflètent les tables de supabase/migrations/ (0001_init.sql, 0003_socle.sql…) en camelCase.
 * Les dates « jour » sont au format AAAA-MM-JJ, les instants en ISO 8601.
 */
// --- Lot 5 ---
import type { CrmAuditAction, CrmTargetType } from "./modules/crm/types.ts";
// --- Lot 4 ---
import type { EngagementAuditAction, EngagementAuditTarget, EngagementNotificationType } from "./modules/engagement/types";

/**
 * Rôles cumulables (table user_roles). Une personne sans rôle est une visiteuse (« guest »).
 * L'ancien rôle « founder » est devenu « admin » (Julia et Nora).
 */
export type Role = "guest" | "member" | "moderator" | "admin" | "partner" | "pro";
/** Rôles attribuables (guest = absence de rôle). */
export type GrantableRole = Exclude<Role, "guest">;
export type Plan = "free" | "member" | "premium";
export type PaidPlan = Exclude<Plan, "free">;

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  whatsapp: string | null;
  email: string | null;
  job: string | null;
  country: string | null;
  bio: string | null;
  /** Rôles cumulés (vide = compte gratuit / visiteuse). Jamais « guest ». */
  roles: GrantableRole[];
  plan: Plan;
  /** Fin de l'adhésion (AAAA-MM-JJ), null pour un compte gratuit. */
  planEndsAt: string | null;
  avatarUrl: string | null;
  /** « À Marrakech depuis » (texte libre : 2019, toujours…). */
  marrakechSince: string | null;
  /** Numéro de carte de membre, ex. « NC 0427 ». */
  cardNumber: string | null;
  createdAt: string;
};

export type PlaceCategory =
  | "manger"
  | "sortir"
  | "bien-etre-sport"
  | "famille"
  | "hotels-piscines"
  | "beaute"
  | "sante"
  | "urgences"
  | "shopping"
  | "pratique";

export type Place = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  area: string;
  note: string;
  categories: PlaceCategory[];
  recommendedBy: string;
  clubEventLabel: string | null;
  clubEventDate: string | null;
  url: string | null;
  image: string | null;
  imagePosition: string | null;
  /** Infos pratiques (annuaire) : téléphone, adresse, horaires. */
  phone: string | null;
  address: string | null;
  hours: string | null;
  tags: string[];
  /** Mise en avant : coup de cœur, nouveau, exclusif. */
  badge: "top" | "new" | "exclusive" | null;
};

export type EventStatus = "draft" | "published" | "cancelled";

export type ProgramStep = { time: string; title: string; text: string };

export type ClubEvent = {
  id: string;
  slug: string;
  title: string;
  /** Titre court pour les encarts (« Lunch au Fer7 »). */
  shortTitle: string | null;
  startsAt: string;
  endsAt: string | null;
  placeId: string | null;
  /** Nom du lieu (null tant qu'il est à confirmer). */
  venue: string | null;
  address: string | null;
  description: string;
  program: ProgramStep[];
  capacity: number;
  pricePublic: number;
  priceMember: number;
  /** Rendez-vous réservé aux Premium, offert. */
  premiumFree: boolean;
  status: EventStatus;
  image: string | null;
  imagePosition: string | null;
  /** Zoom CSS optionnel, ex. « --z:1.7;--zo:22% 88% ». */
  imageZoom: string | null;
  imageCaption: string | null;
  featured: boolean;
  createdAt: string;
};

export type BookingStatus = "pending" | "paid" | "offered" | "waitlist" | "cancelled";
export type PayMethod = "card" | "transfer" | "free";

export type Booking = {
  id: string;
  eventId: string;
  profileId: string | null;
  guestFirstName: string | null;
  guestWhatsapp: string | null;
  status: BookingStatus;
  amount: number;
  method: PayMethod;
  ticketCode: string;
  stripeSessionId: string | null;
  createdAt: string;
};

export type PaymentKind = "booking" | "membership";
export type PaymentStatus = "declared" | "validated" | "refunded";

export type Payment = {
  id: string;
  profileId: string | null;
  /** Nom affiché (utile pour les réservations sans compte). */
  payerName: string;
  kind: PaymentKind;
  bookingId: string | null;
  plan: PaidPlan | null;
  /** join | renew | upgrade pour une adhésion. */
  membershipAction: MembershipAction | null;
  amount: number;
  method: PayMethod;
  status: PaymentStatus;
  declaredAt: string;
  validatedAt: string | null;
  validatedBy: string | null;
  stripeSessionId: string | null;
};

export type MembershipAction = "join" | "renew" | "upgrade";

export type Membership = {
  id: string;
  profileId: string;
  plan: PaidPlan;
  startsAt: string;
  endsAt: string;
  status: "active" | "pending" | "expired" | "cancelled";
};

export type Memory = {
  id: string;
  title: string;
  place: string;
  dateLabel: string;
  participants: number;
  image: string;
  imagePosition: string | null;
  attendees: string[];
  sortOrder: number;
};

export type Message = {
  id: string;
  /** « general », « dm:<idA>:<idB> » (ids triés) ou « group:<id> » (groupe thématique, Lot 1). */
  channel: string;
  authorId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** Lot 1 : masqué par la modération (le texte d'origine n'est plus lisible que par les modératrices). */
  hiddenAt?: string | null;
};

export type ReminderReason = "renewal" | "expired" | "unpaid" | "invite";

export type Reminder = {
  id: string;
  profileId: string | null;
  eventId: string | null;
  reason: ReminderReason;
  /** Échéance concernée (AAAA-MM-JJ). */
  dueAt: string | null;
  sentAt: string | null;
  answered: boolean;
  /** Relance automatique programmée (AAAA-MM-JJ). */
  scheduledFor: string | null;
};

export type PartnerOffer = {
  id: string;
  badge: string;
  partner: string;
  detail: string;
  /** Établissement partenaire qui propose l'offre (null si pas encore relié). */
  organizationId: string | null;
};

/* ---------- vues dérivées ---------- */

export type EventStats = {
  /** Places prises (en attente de paiement, payées ou offertes). */
  taken: number;
  paid: number;
  pending: number;
  waitlist: number;
  left: number;
};

export type EventView = ClubEvent & { stats: EventStats };

export type BookingView = Booking & { event: ClubEvent; holderName: string };

export type DmThread = {
  other: Profile;
  last: Message | null;
  unread: number;
};

export type MessageView = Message & { author: Profile | null };

/* ---------- socle : organisations, journal, notifications ---------- */

export type OrganizationKind = "partner" | "pro";
export type OrganizationStatus = "active" | "pending" | "suspended";
export type OrganizationMemberRole = "owner" | "staff";

/** Établissement d'une partenaire (offres) ou d'une professionnelle du carnet (fiche payante), ou les deux. */
export type Organization = {
  id: string;
  slug: string;
  name: string;
  kinds: OrganizationKind[];
  /** Catégorie libre (bien-être, café, santé…). */
  category: string;
  description: string | null;
  address: string | null;
  /** Quartier (Guéliz, Médina, Hivernage…). */
  area: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  status: OrganizationStatus;
  /** Lieu du carnet correspondant, s'il existe. */
  placeId: string | null;
  createdAt: string;
};

export type OrganizationMember = {
  organizationId: string;
  profileId: string;
  role: OrganizationMemberRole;
  createdAt: string;
};

export type AuditAction =
  | "payment.validate"
  | "event.create"
  | "event.update"
  | "event.publish"
  | "role.grant"
  | "role.revoke"
  | "reminder.send"
  // --- Lot 3 ---
  | import("./modules/partenaires/types").PartenairesAuditAction
  // --- Lot 5 ---
  | CrmAuditAction
  // --- Lot 4 ---
  | EngagementAuditAction
  | import("./modules/securite/types").SecuriteAuditAction // --- Lot 6 ---
  // --- Lot 1 ---
  | "news.create"
  | "news.update"
  | "news.publish"
  | "news.delete"
  | "group.create"
  | "group.update"
  | "group.decide"
  | "moderation.hide"
  | "moderation.restore"
  | "moderation.warn"
  | "moderation.dismiss"
  | "keyword.add"
  | "keyword.remove"
  | "event.remind";

/** Journal des opérations importantes (qui, quoi, sur quoi, détails). */
export type AuditEntry = {
  id: string;
  actorId: string | null;
  action: AuditAction;
  targetType: "payment" | "event" | "profile" | "reminder" | "organization" | CrmTargetType /* Lot 5 */ | EngagementAuditTarget /* Lot 4 */ | /* Lot 1 */ "news" | "group" | "message" | "report" | "keyword";
  targetId: string | null;
  /** Phrase lisible (« Virement de Lou Garnier validé · 670 $ »). */
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type NotificationType =
  | "booking_confirmed"
  | "waitlist_spot"
  | "event_published"
  | "payment_validated"
  | "role_changed"
  // --- Lot 5 ---
  | "crm_task_due"
  // --- Lot 4 ---
  | EngagementNotificationType
  // --- Lot 1 ---
  | "news_published"
  | "event_reminder"
  | "group_request"
  | "group_joined"
  | "moderation_report"
  | "moderation_warning";

export type AppNotification = {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Lien interne à ouvrir (/espace/agenda/…). */
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationChannel = "inApp" | "email" | "push";

export type NotificationPref = {
  profileId: string;
  type: NotificationType;
  inApp: boolean;
  email: boolean;
  push: boolean;
};

/** La personne qui regarde la page. */
export type Viewer = {
  /** Rôles effectifs (["guest"] sans compte ou sans rôle). */
  roles: Role[];
  profile: Profile | null;
  /** Codes de billets réservés sans compte (cookie). */
  guestTickets: string[];
  mode: "demo" | "real";
};

export type PaymentMode = "demo" | "stripe" | "transfer";
