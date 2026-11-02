/**
 * Choix du prestataire par configuration (PAYMENT_PROVIDER, voir config.ts).
 * Pour brancher un prestataire marocain (CMI…) : écrire `providers/cmi.ts` qui implémente PaymentProvider
 * (page de paiement hébergée + vérification du retour serveur à serveur), l'ajouter ici, et traduire ses
 * notifications en NormalizedEvent. Aucun écran ni aucune action n'a besoin de changer.
 */
import { today } from "../../../clock";
import { resolveProviderId } from "../config";
import type { ProviderId } from "../types";
import { simulatedProvider } from "./simulated";
import { stripeProvider } from "./stripe";
import { transferProvider } from "./transfer";
import type { PaymentProvider } from "./types";

export function getProvider(id: ProviderId = resolveProviderId(), opts: { fail?: boolean } = {}): PaymentProvider {
  switch (id) {
    case "stripe":
      return stripeProvider();
    case "simulated":
      return simulatedProvider({ today, fail: opts.fail });
    case "transfer":
      return transferProvider();
    default:
      throw new Error(`Prestataire de paiement non disponible : ${id}.`);
  }
}

export function activeProviderId(): Exclude<ProviderId, "cmi"> {
  return resolveProviderId();
}
