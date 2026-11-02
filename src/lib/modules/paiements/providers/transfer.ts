/**
 * Virement déclaré : la personne déclare son virement, une fondatrice le valide à réception
 * (fonction SQL validate_payment, page « À traiter »). Rien ne passe par un prestataire.
 * Paiement comptant uniquement (pas d'échéancier ni d'abonnement automatique).
 */
import type { PaymentProvider } from "./types";

export function transferProvider(): PaymentProvider {
  return {
    id: "transfer",
    label: "Virement bancaire",
    supports: { installments: false, subscriptions: false, portal: false, refunds: false, hosted: false },
    async startCheckout() {
      return { type: "manual" };
    },
  };
}
