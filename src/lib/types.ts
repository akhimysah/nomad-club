/**
 * Types du domaine Nomad Club.
 * Ils reflètent les tables de supabase/migrations/0001_init.sql (en camelCase).
 * Les dates « jour » sont au format AAAA-MM-JJ, les instants en ISO 8601.
 */

export type Role = "guest" | "member" | "founder";
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
  role: Role;
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

export type PlaceCategory = "manger" | "sortir" | "bien-etre-sport" | "famille";

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
  /** « general » ou « dm:<idA>:<idB> » (ids triés). */
  channel: string;
  authorId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
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

/** La personne qui regarde la page. */
export type Viewer = {
  role: Role;
  profile: Profile | null;
  /** Codes de billets réservés sans compte (cookie). */
  guestTickets: string[];
  mode: "demo" | "real";
};

export type PaymentMode = "demo" | "stripe" | "transfer";
