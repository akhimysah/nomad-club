/**
 * Interface commune des prestataires de paiement. Les écrans et les actions n'en connaissent que ceci ;
 * ajouter un prestataire (ex. CMI au Maroc) = écrire une implémentation + sa traduction d'événements.
 */
import type { Checkout, NormalizedEvent, ProviderId, Transaction } from "../types";

export type StartCheckoutInput = {
  checkout: Checkout;
  /** payment : paiement unique ; subscription : prélèvement récurrent (adhésion en plusieurs fois, carnet pro). */
  mode: "payment" | "subscription";
  /** Libellé lisible sur la page de paiement et la facture. */
  label: string;
  customerEmail: string | null;
  /** Client déjà connu chez le prestataire (carte enregistrée). */
  customerRef: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Paiement unique : la session expire (place retenue libérée). */
  expiresInMinutes?: number;
  /** Abonnement : montant de chaque mois ; `firstExtra` s'ajoute à la première facture (arrondi de l'échéancier). */
  recurring?: { amount: number; firstExtra?: number; priceId?: string | null; label?: string };
};

export type StartCheckoutResult =
  /** Page de paiement hébergée (Stripe Checkout) : rediriger la personne. */
  | { type: "redirect"; url: string; sessionRef: string }
  /** Paiement immédiat (simulé) : événements à traiter tout de suite, comme s'ils venaient du webhook. */
  | { type: "events"; sessionRef: string; events: NormalizedEvent[] }
  /** Paiement hors ligne (virement) : rien à faire chez un prestataire, validation par une fondatrice. */
  | { type: "manual" }
  | { type: "error"; error: string };

export type VerifiedWebhook = { eventId: string; type: string; payload: unknown; events: NormalizedEvent[] };

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Ce que le prestataire sait faire (les écrans s'y adaptent). */
  supports: { installments: boolean; subscriptions: boolean; portal: boolean; refunds: boolean; hosted: boolean };
  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult>;
  /** Limite un abonnement à `count` prélèvements (adhésion en N fois), à partir de sa date de début. */
  limitSubscription?(subscriptionRef: string, count: number): Promise<void>;
  setCancelAtPeriodEnd?(subscriptionRef: string, cancel: boolean): Promise<void>;
  /** Change le montant mensuel (appliqué à la prochaine échéance, sans prorata). */
  changeSubscriptionAmount?(subscriptionRef: string, amount: number, priceId: string | null): Promise<void>;
  /** Portail client du prestataire (changer de carte, factures, résiliation). */
  portalUrl?(customerRef: string, returnUrl: string): Promise<string>;
  refund?(tx: Transaction, amount: number, reason: string | null): Promise<{ refundRef: string | null }>;
  /** Vérifie la signature d'un webhook et le traduit. Lève une erreur si la signature est invalide. */
  verifyWebhook?(rawBody: string, headers: Headers): VerifiedWebhook;
  /** Retraduit un événement stocké (pour le rejouer). */
  normalize?(payload: unknown): NormalizedEvent[];
}
