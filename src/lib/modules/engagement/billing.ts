/**
 * Paiement de la boutique : UNE SEULE fonction à remplacer au Lot 2 (vrai paiement : Stripe, CMI…).
 *
 * Aujourd'hui le paiement est simulé : aucune somme n'est débitée, une référence « SIM-… » est générée.
 * - Démo : toujours accepté.
 * - Réel : la base n'accepte l'achat que si `engagement_settings.simulated_payments` est vrai
 *   (fonction SQL purchase_product_simulated) ; sinon l'achat est refusé proprement.
 *
 * Au Lot 2 : `payForProduct` créera la session de paiement (ou l'échéancier) et l'achat sera enregistré
 * par le webhook du prestataire, au lieu de l'être tout de suite après cet appel.
 */
import { randomBytes } from "node:crypto";
import { inCircle } from "../../permissions";
import type { Profile } from "../../types";
import type { Product, PurchaseMethod } from "./types";

export type Charge = { ok: true; amount: number; method: PurchaseMethod; reference: string | null } | { ok: false; error: string };

/** Prix payé par cette personne (prix membre pour le cercle). */
export function priceFor(product: Pick<Product, "price" | "priceMember">, profile: Pick<Profile, "roles"> | null): number {
  return profile && inCircle(profile) ? product.priceMember : product.price;
}

export async function payForProduct(product: Product, profile: Profile, opts: { simulatedAllowed: boolean }): Promise<Charge> {
  const amount = priceFor(product, profile);
  if (amount === 0) return { ok: true, amount, method: "free", reference: null };
  if (!opts.simulatedAllowed) return { ok: false, error: "Le paiement en ligne de la boutique arrive bientôt. Écris aux fondatrices pour recevoir ce guide." };
  return { ok: true, amount, method: "simulated", reference: `SIM-${randomBytes(4).toString("hex").toUpperCase()}` };
}
