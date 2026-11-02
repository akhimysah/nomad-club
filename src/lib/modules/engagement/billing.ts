/**
 * Paiement de la boutique : UNE SEULE fonction, `payForProduct`.
 *
 * --- Vague 2 · paiements --- : le paiement simulé du Lot 4 est remplacé par le prestataire configuré
 * (src/lib/modules/paiements : Stripe en production, simulé en démo uniquement). L'achat n'est plus
 * enregistré ici : il l'est à la CONFIRMATION du paiement (webhook Stripe, ou paiement simulé traité
 * par le même code), ce qui donne l'accès aux fichiers. Seules les ressources gratuites sont accordées
 * tout de suite.
 */
import { inCircle } from "../../permissions";
import type { Profile } from "../../types";
import { startShopPayment } from "../paiements/service";
import type { Product } from "./types";

export type Charge =
  /** Ressource offerte : à enregistrer tout de suite (méthode « free »). */
  | { ok: true; kind: "free"; amount: 0 }
  /** Page de paiement du prestataire : rediriger la personne. */
  | { ok: true; kind: "redirect"; amount: number; url: string }
  /** Paiement confirmé et accès déjà accordé (paiement simulé en démo). */
  | { ok: true; kind: "paid"; amount: number }
  | { ok: false; error: string };

/** Prix payé par cette personne (prix membre pour le cercle). */
export function priceFor(product: Pick<Product, "price" | "priceMember">, profile: Pick<Profile, "roles"> | null): number {
  return profile && inCircle(profile) ? product.priceMember : product.price;
}

export async function payForProduct(product: Product, profile: Profile, opts: { base: string }): Promise<Charge> {
  const amount = priceFor(product, profile);
  if (amount === 0) return { ok: true, kind: "free", amount: 0 };
  const r = await startShopPayment({ productId: product.id, productTitle: product.title, productSlug: product.slug, amount, profile, base: opts.base });
  if (!r.ok) return r;
  if (r.type === "redirect") return { ok: true, kind: "redirect", amount, url: r.url };
  if (r.type === "done") return { ok: true, kind: "paid", amount };
  return { ok: false, error: "Le paiement en ligne de la boutique n’est pas encore activé. Écris aux fondatrices pour recevoir ce guide." };
}
