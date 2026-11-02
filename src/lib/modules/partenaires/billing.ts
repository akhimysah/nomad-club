/**
 * Lot 3 — paiement de l'abonnement mensuel des pros du carnet : seul point d'entrée, `paySubscription()`.
 *
 * --- Vague 2 · paiements --- : le paiement simulé est remplacé par le prestataire configuré
 * (src/lib/modules/paiements) :
 * - Stripe : abonnement mensuel (Checkout puis Billing) ; les mois suivants sont prélevés automatiquement,
 *   les statuts actif / en retard / suspendu sont synchronisés par le webhook ; carte et résiliation par le
 *   portail client Stripe ;
 * - simulé (démo uniquement) : même parcours, traité par le même code que le webhook ;
 * - virement : pas d'abonnement automatique (à régler avec les fondatrices).
 */
import { getRepo } from "../../data";
import type { Profile } from "../../types";
import { getProvider } from "../paiements/providers";
import { simulateProInvoice, startProSubscription } from "../paiements/service";
import { effectiveStatus } from "./domain";
import { today } from "../../clock";
import type { ProPlan } from "./types";

export type PayResult = { ok: true; kind: "redirect"; url: string } | { ok: true; kind: "paid" } | { ok: false; error: string };

/** S'abonner (premier mois) ou, en démo, régler le mois suivant ; `fail` simule un refus de carte (démo). */
export async function paySubscription(organizationId: string, plan: ProPlan, profile: Profile, opts: { base: string; fail?: boolean }): Promise<PayResult> {
  const provider = getProvider();
  const sub = await getRepo().getSubscription(organizationId);
  if (provider.id === "simulated" && sub) {
    const r = await simulateProInvoice(organizationId, { fail: opts.fail });
    if (!r.ok) return { ok: false, error: r.error ?? "Paiement impossible." };
    return opts.fail ? { ok: false, error: "Paiement refusé par la banque (simulation)." } : { ok: true, kind: "paid" };
  }
  if (provider.id === "simulated" && opts.fail) return { ok: false, error: "Paiement refusé par la banque (simulation)." };
  const live = sub && sub.subscriptionRef && sub.provider === provider.id && effectiveStatus(sub, today()) !== "cancelled" && sub.status !== "cancelled";
  if (live) return { ok: false, error: "Ton abonnement est prélevé automatiquement chaque mois. Pour changer de carte ou régler une échéance, utilise « Gérer ma carte »." };
  const r = await startProSubscription({ organizationId, plan, profile, base: opts.base });
  if (!r.ok) return r;
  if (r.type === "redirect") return { ok: true, kind: "redirect", url: r.url };
  if (r.type === "done") return { ok: true, kind: "paid" };
  return { ok: false, error: "Le paiement en ligne n’est pas activé : écris aux fondatrices pour régler ton abonnement." };
}
