import { addYears } from "../clock";
import { PRICES } from "../content";
import type { MembershipAction, PaidPlan, Profile } from "../types";

export function membershipAmount(action: MembershipAction, plan: PaidPlan): number {
  if (action === "upgrade") return PRICES.upgrade;
  return plan === "premium" ? PRICES.premium : PRICES.member;
}

export function planPrice(plan: PaidPlan): number {
  return plan === "premium" ? PRICES.premium : PRICES.member;
}

/**
 * Effet d'une adhésion payée (validée) sur un profil.
 * - adhésion : un an à partir d'aujourd'hui ;
 * - renouvellement : un an de plus à partir de la fin actuelle (ou d'aujourd'hui si elle est échue) ;
 * - passage Premium : même échéance, formule Premium.
 */
export function applyMembership(
  profile: Profile,
  action: MembershipAction,
  plan: PaidPlan,
  today: string,
): { plan: PaidPlan; planEndsAt: string; startsAt: string; role: Profile["role"] } {
  const role = profile.role === "founder" ? "founder" : "member";
  if (action === "upgrade") {
    const end = profile.planEndsAt && profile.planEndsAt >= today ? profile.planEndsAt : addYears(today, 1);
    return { plan: "premium", planEndsAt: end, startsAt: today, role };
  }
  if (action === "renew" && profile.planEndsAt && profile.planEndsAt >= today) {
    return { plan, planEndsAt: addYears(profile.planEndsAt, 1), startsAt: profile.planEndsAt, role };
  }
  return { plan, planEndsAt: addYears(today, 1), startsAt: today, role };
}
