/**
 * Vague 2 · Contrats — abonnement au point d'extension des paiements (src/lib/payment-hooks.ts).
 * Importé par src/instrumentation.ts (démarrage du serveur) et par les modules qui émettent une souscription :
 * l'enregistrement est idempotent (une seule fois par processus, même si le module est chargé plusieurs fois).
 */
import { onSubscriptionActivated } from "../../payment-hooks";
import { handleSubscriptionActivated } from "./service";

type G = typeof globalThis & { __ncContratsSubscribed?: boolean };

export function registerContrats(): void {
  const g = globalThis as G;
  if (g.__ncContratsSubscribed) return;
  g.__ncContratsSubscribed = true;
  onSubscriptionActivated(async (e) => {
    await handleSubscriptionActivated(e);
  });
}

registerContrats();
