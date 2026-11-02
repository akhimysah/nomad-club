"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { membershipAmount } from "@/lib/domain/membership";
import { paymentMode } from "@/lib/env";
import { fullName, ymdDots, ymdLong } from "@/lib/format";
import { claimReferral } from "@/lib/modules/engagement/referral"; // --- Lot 4 ---
import type { MembershipAction, PaidPlan } from "@/lib/types";
import { guestSchema } from "@/lib/validation";

export type MembershipInput = { action: MembershipAction; plan: PaidPlan; firstName?: string; whatsapp?: string; referralCode?: string /* --- Lot 4 --- */ };

export type MembershipResult =
  | { ok: true; declared: boolean; name: string; fullName: string; plan: PaidPlan; validUntil: string; validUntilLong: string; cardNumber: string }
  | { ok: false; error: string; field?: "firstName" | "whatsapp"; needLogin?: boolean };

/**
 * Adhérer, renouveler ou passer Premium.
 * Démo : paiement simulé, appliqué tout de suite (une visiteuse qui adhère devient une nouvelle adhérente).
 * Réel sans Stripe : virement déclaré, appliqué quand les fondatrices le valident.
 */
export async function startMembership(input: MembershipInput): Promise<MembershipResult> {
  const viewer = await getViewer();
  const repo = getRepo();
  const mode = paymentMode();
  if (mode === "stripe") return { ok: false, error: "Le paiement passe par Stripe." };
  let profile = viewer.profile;
  if (input.action !== "join" && !profile) return { ok: false, error: "Connecte-toi d’abord.", needLogin: true };
  if (!profile) {
    if (viewer.mode === "real") return { ok: false, error: "Connecte-toi avec ton e-mail pour adhérer.", needLogin: true };
    const parsed = guestSchema.safeParse({ firstName: input.firstName ?? "", whatsapp: input.whatsapp ?? "" });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue.message, field: issue.path[0] === "whatsapp" ? "whatsapp" : "firstName" };
    }
    profile = await repo.createGuestProfile({ firstName: parsed.data.firstName, lastName: "", whatsapp: parsed.data.whatsapp, email: null });
  }
  // --- Lot 4 --- : adhésion parrainée (avant le rôle membre, qui déclenche la récompense de la marraine)
  if (input.action === "join") await claimReferral(profile.id, input.referralCode);
  if (input.action === "upgrade" && profile.plan === "premium") return { ok: false, error: "Tu es déjà Premium." };
  const plan: PaidPlan = input.action === "upgrade" ? "premium" : input.action === "renew" ? (profile.plan === "premium" ? "premium" : "member") : input.plan;
  const declared = mode === "transfer";
  await repo.recordMembership({
    profileId: profile.id,
    payerName: fullName(profile),
    action: input.action,
    plan,
    amount: membershipAmount(input.action, plan),
    method: declared ? "transfer" : "card",
    status: declared ? "declared" : "validated",
  });
  const updated = (await repo.getProfile(profile.id)) ?? profile;
  revalidatePath("/", "layout");
  return {
    ok: true,
    declared,
    name: updated.firstName,
    fullName: fullName(updated),
    plan: declared ? plan : updated.plan === "premium" ? "premium" : "member",
    validUntil: updated.planEndsAt ? ymdDots(updated.planEndsAt) : "",
    validUntilLong: updated.planEndsAt ? ymdLong(updated.planEndsAt) : "",
    cardNumber: updated.cardNumber ?? "NC 0000",
  };
}
