/**
 * Lot 3 — partenaires, carnet pro et carte : types du module.
 * Ils reflètent supabase/migrations/0005_partenaires.sql en camelCase.
 */
import type { Organization, PartnerOffer, PlaceCategory } from "../../types";

/** Actions journalisées par le module (audit_log.action). */
export type PartenairesAuditAction =
  | "organization.update"
  | "organization.invite"
  | "offer.create"
  | "offer.update"
  | "offer.pause"
  | "offer.resume"
  | "offer_code.validate"
  | "subscription.pay"
  | "subscription.change"
  | "subscription.cancel";

/* ---------- fiche établissement ---------- */

export type EstablishmentDetails = {
  organizationId: string;
  /** Adresses des photos (/img/… ou https://…), 8 au plus. */
  photos: string[];
  hours: string | null;
  whatsapp: string | null;
  /** Catégorie du carnet (filtres du carnet et de la carte). */
  carnetCategory: PlaceCategory | null;
  /** Réduction optionnelle d'une pro du carnet pour les membres. */
  memberDiscount: string | null;
  updatedAt: string;
};

/** Organisation + compléments de fiche (une fiche vide si rien n'est encore saisi). */
export type Establishment = Organization & { details: EstablishmentDetails };

export type EstablishmentInput = {
  description: string | null;
  address: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  photos: string[];
  hours: string | null;
  whatsapp: string | null;
  carnetCategory: PlaceCategory | null;
  memberDiscount: string | null;
};

/* ---------- offres ---------- */

export type OfferAudience = "all" | "member" | "premium";
export type OfferStatus = "active" | "paused";

/** Offre partenaire complète (la table partner_offers enrichie par 0005). */
export type Offer = PartnerOffer & {
  /** Titre (« Un café offert »). Le badge reste la réduction ou l'avantage court (« -15 % »). */
  title: string;
  conditions: string | null;
  validFrom: string | null;
  validUntil: string | null;
  audience: OfferAudience;
  status: OfferStatus;
  createdAt: string;
};

export type OfferInput = {
  title: string;
  badge: string;
  detail: string;
  conditions: string | null;
  validFrom: string | null;
  validUntil: string | null;
  audience: OfferAudience;
};

/** Code personnel d'une membre pour une offre (un code ouvert à la fois, horodaté). */
export type OfferCode = {
  id: string;
  offerId: string;
  organizationId: string | null;
  profileId: string;
  code: string;
  createdAt: string;
  validatedAt: string | null;
  validatedBy: string | null;
};

export type ValidatedCode = {
  code: string;
  offerId: string;
  offerTitle: string;
  badge: string;
  organizationId: string | null;
  firstName: string;
  premium: boolean;
  createdAt: string;
  validatedAt: string;
};

export type ValidateResult = { ok: true; validated: ValidatedCode } | { ok: false; error: string };

/* ---------- statistiques ---------- */

export type OrgStatKind = "view" | "contact" | "whatsapp" | "directions";

export type MonthlyStats = {
  /** AAAA-MM */
  month: string;
  views: number;
  contactClicks: number;
  whatsappClicks: number;
  directionsClicks: number;
  codesGenerated: number;
  codesValidated: number;
};

export type OfferStats = { offerId: string; generated: number; validated: number };

/* ---------- abonnement des pros ---------- */

export type ProPlan = "essentiel" | "visibilite" | "vitrine";
export type SubscriptionStatus = "active" | "past_due" | "suspended" | "cancelled";

export type ProSubscription = {
  organizationId: string;
  plan: ProPlan;
  monthlyPrice: number;
  status: SubscriptionStatus;
  startedAt: string;
  /** Prochaine échéance (AAAA-MM-JJ). */
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

export type SubscriptionPayment = {
  id: string;
  organizationId: string;
  plan: ProPlan;
  amount: number;
  status: "paid" | "failed";
  method: "simulated" | "card" | "transfer";
  reference: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

/* ---------- équipe ---------- */

export type OrgInvite = {
  id: string;
  organizationId: string;
  email: string;
  invitedBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
};

/* ---------- carte ---------- */

export type LocationPrecision = "area" | "approx";
export type LocationDisplay = "name" | "anonymous";

export type MemberLocation = {
  profileId: string;
  sharing: boolean;
  precision: LocationPrecision;
  display: LocationDisplay;
  area: string | null;
  /** Toujours arrondies (~500 m) ou au centre du quartier : jamais la position exacte. */
  lat: number | null;
  lng: number | null;
  consentedAt: string | null;
  updatedAt: string;
};

export type LocationInput = {
  sharing: boolean;
  precision: LocationPrecision;
  display: LocationDisplay;
  area: string | null;
  lat: number | null;
  lng: number | null;
};

/** Point d'une membre sur la carte (déjà approximatif). */
export type MemberPin = {
  profileId: string;
  label: string;
  job: string | null;
  area: string | null;
  lat: number;
  lng: number;
  anonymous: boolean;
};

/* ---------- données d'exemple (mode démo) ---------- */

export type PartenairesSeed = {
  details: EstablishmentDetails[];
  offerCodes: OfferCode[];
  stats: Array<{ organizationId: string; month: string; views: number; contactClicks: number; whatsappClicks: number; directionsClicks: number }>;
  subscriptions: ProSubscription[];
  subscriptionPayments: SubscriptionPayment[];
  invites: OrgInvite[];
  locations: MemberLocation[];
};
