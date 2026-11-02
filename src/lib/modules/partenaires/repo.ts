/**
 * Lot 3 — accès aux données du module partenaires / carnet pro / carte.
 * L'interface `Repo` (src/lib/data/repo.ts) l'étend ; implémentations : demo.ts (mémoire) et supabase.ts (Postgres).
 */
import type {
  Establishment,
  EstablishmentInput,
  LocationInput,
  MemberLocation,
  MemberPin,
  MonthlyStats,
  Offer,
  OfferCode,
  OfferInput,
  OfferStats,
  OfferStatus,
  OrgInvite,
  OrgStatKind,
  ProPlan,
  ProSubscription,
  SubscriptionPayment,
  ValidateResult,
} from "./types";
import type { OrganizationKind } from "../../types";

export type ClaimResult = { ok: true; code: OfferCode } | { ok: false; error: string };
export type InviteResult = { ok: true; joinedProfileId: string | null } | { ok: false; error: string };

/** Paiement d'abonnement déjà encaissé (ou refusé) par billing.ts, à enregistrer. */
export type SubscriptionPaymentInput = {
  organizationId: string;
  plan: ProPlan;
  amount: number;
  status: "paid" | "failed";
  reference: string;
  periodStart: string;
  periodEnd: string;
  // --- Vague 2 · paiements --- : moyen réel (carte via Stripe) ; « simulated » par défaut
  method?: SubscriptionPayment["method"];
  provider?: string;
};

/** --- Vague 2 · paiements --- : statut, échéance et références synchronisés par le webhook du prestataire. */
export type SubscriptionPatch = {
  plan?: ProPlan;
  monthlyPrice?: number;
  cancelAtPeriodEnd?: boolean;
  status?: ProSubscription["status"];
  currentPeriodEnd?: string;
  provider?: string;
  subscriptionRef?: string | null;
  customerRef?: string | null;
};

export interface PartenairesRepo {
  /* fiches établissements */
  /** Établissements (fiche complète). `kind` filtre partenaires / pros ; `activeOnly` : statut actif seulement. */
  listEstablishments(opts?: { kind?: OrganizationKind; activeOnly?: boolean }): Promise<Establishment[]>;
  getEstablishment(idOrSlug: string): Promise<Establishment | null>;
  updateEstablishment(organizationId: string, input: EstablishmentInput): Promise<Establishment>;

  /* offres */
  /** Offres ; `organizationId` pour un établissement, `activeOnly` pour la vue membre. */
  listOffers(opts?: { organizationId?: string; activeOnly?: boolean }): Promise<Offer[]>;
  getOffer(id: string): Promise<Offer | null>;
  createOffer(organizationId: string, input: OfferInput): Promise<Offer>;
  updateOffer(id: string, input: OfferInput): Promise<Offer>;
  setOfferStatus(id: string, status: OfferStatus): Promise<Offer>;

  /* codes personnels */
  /** Code ouvert de la membre pour cette offre, ou un nouveau (contrôle du public visé et de la validité). */
  claimOfferCode(offerId: string, profileId: string): Promise<ClaimResult>;
  listCodesForProfile(profileId: string): Promise<OfferCode[]>;
  /** Validation au comptoir par l'équipe de l'établissement (ou une administratrice). */
  validateOfferCode(code: string, actorId: string, organizationIds: string[] | "all"): Promise<ValidateResult>;
  listOrgCodes(organizationId: string, opts?: { validatedOnly?: boolean; limit?: number }): Promise<OfferCode[]>;

  /* statistiques */
  /** Compte une vue de fiche ou un clic de contact (ignoré si la personne fait partie de l'établissement). */
  trackOrgEvent(organizationId: string, kind: OrgStatKind, profileId: string): Promise<void>;
  /** Statistiques des `months` derniers mois (le plus ancien d'abord), mois sans activité compris. */
  orgMonthlyStats(organizationId: string, months: number): Promise<MonthlyStats[]>;
  offerStats(organizationId: string): Promise<OfferStats[]>;

  /* abonnement des pros */
  getSubscription(organizationId: string): Promise<ProSubscription | null>;
  /** Abonnements de tous les pros visibles par la personne (carnet : seuls les actifs comptent). */
  listSubscriptions(): Promise<ProSubscription[]>;
  listSubscriptionPayments(organizationId: string): Promise<SubscriptionPayment[]>;
  /** Enregistre un paiement ; s'il est payé, l'abonnement passe actif jusqu'à `periodEnd` avec cette formule. */
  recordSubscriptionPayment(input: SubscriptionPaymentInput & { monthlyPrice: number }): Promise<ProSubscription>;
  /** Change la formule (effet à la prochaine échéance) ou programme / annule l'arrêt en fin de période. */
  updateSubscription(organizationId: string, patch: SubscriptionPatch): Promise<ProSubscription>;
  /** Met à jour les statuts échus (retard puis suspension). Renvoie le nombre de changements. */
  refreshSubscriptions(todayYmd: string): Promise<number>;

  /* équipe */
  inviteOrgMember(organizationId: string, email: string, actorId: string): Promise<InviteResult>;
  listOrgInvites(organizationId: string): Promise<OrgInvite[]>;

  /* carte */
  getMemberLocation(profileId: string): Promise<MemberLocation | null>;
  setMemberLocation(profileId: string, input: LocationInput): Promise<MemberLocation>;
  /** Positions partagées par les membres qui ont consenti (déjà approximatives). */
  listMemberPins(): Promise<MemberPin[]>;
}
