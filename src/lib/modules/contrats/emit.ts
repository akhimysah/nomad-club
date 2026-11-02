/**
 * Vague 2 · Contrats — émission de « souscription activée » pour les cas qui ne passent pas par le module
 * paiements : l'adhésion réglée par virement, activée quand une fondatrice valide le virement.
 * (Carte et démo : c'est le module paiements qui émet l'événement, avec l'échéancier réel.)
 * Chaque appel est sans risque : erreurs avalées, et handleSubscriptionActivated est idempotent (un même
 * paiement émis deux fois ne crée pas deux contrats).
 */
import { today } from "../../clock";
import { getRepo } from "../../data";
import { emitSubscriptionActivated } from "../../payment-hooks";
import type { Payment } from "../../types";
import { appCurrency } from "./domain";
import "./register";

/** Adhésion payée (démo, Stripe confirmé) ou virement validé par les fondatrices. */
export async function emitMembershipActivated(pay: Payment | null): Promise<void> {
  try {
    if (!pay || pay.kind !== "membership" || pay.status !== "validated" || !pay.profileId || !pay.plan) return;
    const p = await getRepo().getProfile(pay.profileId);
    const endsAt = p?.planEndsAt ?? null;
    await emitSubscriptionActivated({
      kind: "membership",
      profileId: pay.profileId,
      plan: pay.membershipAction === "upgrade" ? "premium" : pay.plan,
      amount: pay.amount,
      currency: appCurrency(),
      installments: 1,
      startsAt: (pay.validatedAt ?? pay.declaredAt).slice(0, 10),
      endsAt,
      reference: pay.id,
    });
  } catch (e) {
    console.error("[contrats] émission adhésion", e instanceof Error ? e.message : e);
  }
}

/** Abonnement pro payé (paiement simulé de partenaires/billing.ts aujourd'hui). */
export async function emitProSubscriptionActivated(input: { profileId: string; organizationId: string; plan: string; amount: number; reference: string; startsAt?: string }): Promise<void> {
  try {
    await emitSubscriptionActivated({
      kind: "pro_listing",
      profileId: input.profileId,
      organizationId: input.organizationId,
      plan: input.plan,
      amount: input.amount,
      currency: appCurrency(),
      installments: 1,
      startsAt: input.startsAt ?? today(),
      endsAt: null,
      reference: input.reference,
    });
  } catch (e) {
    console.error("[contrats] émission abonnement pro", e instanceof Error ? e.message : e);
  }
}
