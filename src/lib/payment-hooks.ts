/**
 * Points d'extension appelés par le module paiements (vague 2) quand une souscription devient active.
 * Le chantier contrats s'y abonne avec `onSubscriptionActivated` pour générer le contrat ; tant que personne
 * n'est abonné, rien ne se passe. Les erreurs d'un abonné n'interrompent jamais le paiement.
 */
export type SubscriptionKind = "membership" | "pro_listing" | "partner";

export type SubscriptionActivated = {
  kind: SubscriptionKind;
  profileId: string;
  /** Établissement concerné (pro / partenaire). */
  organizationId?: string | null;
  /** Formule : "member" | "premium" | identifiant de formule pro… */
  plan: string;
  /** Montant total en unités de la devise (ex. 670). */
  amount: number;
  currency: string;
  /** Nombre d'échéances (1 = comptant). */
  installments: number;
  startsAt: string;
  endsAt: string | null;
  /** Identifiant du paiement ou de l'abonnement côté appli. */
  reference: string;
};

type Listener = (event: SubscriptionActivated) => Promise<void> | void;

// Partagé par tout le processus (globalThis) : un abonné enregistré au démarrage (src/instrumentation.ts)
// est vu par les routes et server actions, même si les bundles chargent ce module plusieurs fois.
const g = globalThis as typeof globalThis & { __ncSubscriptionListeners?: Listener[] };
const listeners: Listener[] = (g.__ncSubscriptionListeners ??= []);

export function onSubscriptionActivated(fn: Listener): void {
  listeners.push(fn);
}

export async function emitSubscriptionActivated(event: SubscriptionActivated): Promise<void> {
  for (const fn of listeners) {
    try {
      await fn(event);
    } catch (err) {
      console.error("[paiements] abonné en erreur", err);
    }
  }
}
