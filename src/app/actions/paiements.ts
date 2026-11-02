"use server";

/**
 * Vague 2 · paiements — actions : portail client (changer de carte, résilier), régularisation d'une échéance
 * (démo), remboursement et rejeu d'un événement (fondatrices), tâche du jour lancée à la main.
 */
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { checkCapability, getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { runDailyPayments } from "@/lib/modules/paiements/cron";
import { portalUrl, refundTransaction, replayEvent, simulateNextInstallment } from "@/lib/modules/paiements/service";
import type { ProviderId } from "@/lib/modules/paiements/types";
import { orgAccess } from "@/lib/modules/partenaires/server";
import { siteUrl } from "@/lib/site";

export type PayActionResult = { ok: true; message: string; url?: string } | { ok: false; error: string };

const refreshAll = () => revalidatePath("/", "layout");

/** Ouvre le portail client du prestataire (carte, factures, résiliation) pour soi ou pour son établissement. */
export async function openPortalAction(organizationId?: string): Promise<PayActionResult> {
  const v = await getViewer();
  if (!v.profile) return { ok: false, error: "Connecte-toi d’abord." };
  const base = await siteUrl();
  let url: string | null = null;
  try {
    if (organizationId) {
      const acc = await orgAccess(organizationId, "subscription.manage_own");
      if (!acc) return { ok: false, error: "Tu ne peux pas gérer cet abonnement." };
      url = await portalUrl({ organizationId }, `${base}/pro/abonnement?org=${organizationId}`);
    } else {
      url = await portalUrl({ profileId: v.profile.id }, `${base}/mes-paiements`);
    }
  } catch (e) {
    console.error("[paiements] portail", e instanceof Error ? e.message : e);
    return { ok: false, error: "Le portail de paiement n’a pas pu s’ouvrir. Réessaie dans un instant." };
  }
  if (!url) return { ok: false, error: "Aucune carte enregistrée pour l’instant : elle le sera à ton premier paiement en ligne." };
  return { ok: true, message: "Ouverture du portail…", url };
}

/** Démo : régler maintenant (ou simuler un refus de) la prochaine échéance d'un échéancier. */
export async function payNextInstallmentAction(planId: string, fail = false): Promise<PayActionResult> {
  const v = await getViewer();
  if (!v.profile) return { ok: false, error: "Connecte-toi d’abord." };
  if (v.mode !== "demo") return { ok: false, error: "Mets ta carte à jour depuis le portail : le prélèvement repartira tout seul." };
  const plan = typeof planId === "string" ? await getRepo().payGetPlan(planId) : null;
  if (!plan || (plan.profileId !== v.profile.id && !(await checkCapability("payments.validate")))) return { ok: false, error: "Échéancier introuvable." };
  const r = await simulateNextInstallment(planId, { fail });
  refreshAll();
  return r.ok ? { ok: true, message: fail ? "Refus de carte simulé." : "Échéance réglée (paiement simulé)." } : { ok: false, error: r.error ?? "Impossible." };
}

/** Fondatrices : remboursement total ou partiel d'un encaissement (via le prestataire). */
export async function refundAction(transactionId: string, amount: number, reason: string): Promise<PayActionResult> {
  const f = await checkCapability("payments.validate");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  if (typeof transactionId !== "string" || !Number.isFinite(amount)) return { ok: false, error: "Demande invalide." };
  const r = await refundTransaction({ transactionId, amount, reason: (reason ?? "").trim().slice(0, 300) || null, actorId: f.profile.id });
  refreshAll();
  return r.ok ? { ok: true, message: `Remboursement effectué · ${r.transaction.receiptNumber}` } : { ok: false, error: r.error };
}

/** Fondatrices : rejoue un événement de prestataire (après une erreur). */
export async function replayEventAction(provider: string, eventId: string): Promise<PayActionResult> {
  const f = await checkCapability("payments.validate");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  if (!["stripe", "simulated", "transfer", "cmi"].includes(provider) || typeof eventId !== "string" || eventId.length > 200) return { ok: false, error: "Événement inconnu." };
  const r = await replayEvent(provider as ProviderId, eventId, f.profile.id);
  refreshAll();
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
}

/** Fondatrices : lance la tâche quotidienne des paiements tout de suite (relances, suspensions, rappels). */
export async function runPaymentsNowAction(): Promise<PayActionResult> {
  const f = await checkCapability("payments.validate");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  try {
    const s = await runDailyPayments();
    await audit({ actorId: f.profile.id, action: "reminder.send", targetType: "reminder", targetId: null, summary: "Tâche des paiements lancée à la main", details: s });
    refreshAll();
    return {
      ok: true,
      message: `${s.overdueReminders} relance(s) d’échéance, ${s.renewalReminders} rappel(s) de renouvellement, ${s.suspended} suspension(s), ${s.reinstated} rétablissement(s).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec." };
  }
}
