import Stripe from "stripe";

let client: Stripe | null = null;

/** Client Stripe (serveur uniquement). Nécessite STRIPE_SECRET_KEY (clé de test « sk_test_… » pour commencer). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");
  if (!client) client = new Stripe(key, { appInfo: { name: "Nomad Club" } });
  return client;
}
