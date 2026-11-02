/** Indicateurs du Lot 4 pour l'espace fondatrices (module pur). */
import { addDays } from "../../clock";
import type { DealCategory, DealView, PurchaseView, ReferralView } from "./types";

export type MonthBar = { key: string; label: string; value: number };

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Les `n` derniers mois (AAAA-MM), du plus ancien au plus récent. */
export function lastMonths(todayYmd: string, n: number): Array<{ key: string; label: string }> {
  const [y, m] = todayYmd.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()] };
  });
}

export function businessStats(deals: DealView[], todayYmd: string) {
  const confirmed = deals.filter((d) => d.status === "confirmed");
  const volume = confirmed.reduce((s, d) => s + (d.amount ?? 0), 0);
  const since30 = addDays(todayYmd, -30);
  const months = lastMonths(todayYmd, 6).map((mo) => ({
    ...mo,
    value: confirmed.filter((d) => d.dealDate.startsWith(mo.key)).reduce((s, d) => s + (d.amount ?? 0), 0),
    count: confirmed.filter((d) => d.dealDate.startsWith(mo.key)).length,
  }));
  const byCategory = new Map<DealCategory, { count: number; amount: number }>();
  for (const d of confirmed) {
    const c = byCategory.get(d.category) ?? { count: 0, amount: 0 };
    c.count += 1;
    c.amount += d.amount ?? 0;
    byCategory.set(d.category, c);
  }
  const people = new Map<string, { name: string; count: number; amount: number }>();
  for (const d of confirmed)
    for (const [id, name] of [
      [d.declaredBy, d.declaredByName],
      [d.partnerId, d.partnerName],
    ] as const) {
      const p = people.get(id) ?? { name, count: 0, amount: 0 };
      p.count += 1;
      p.amount += d.amount ?? 0;
      people.set(id, p);
    }
  const answered = deals.filter((d) => d.status !== "pending").length;
  return {
    confirmed: confirmed.length,
    pending: deals.filter((d) => d.status === "pending").length,
    refused: deals.filter((d) => d.status === "refused").length,
    volume,
    average: confirmed.filter((d) => d.amount).length ? Math.round(volume / confirmed.filter((d) => d.amount).length) : 0,
    last30: confirmed.filter((d) => d.dealDate >= since30).length,
    confirmRate: answered ? Math.round((confirmed.length / answered) * 100) : 0,
    activeMembers: people.size,
    months,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1].amount - a[1].amount),
    topConnectors: [...people.entries()].sort((a, b) => b[1].count - a[1].count || b[1].amount - a[1].amount).slice(0, 5),
  };
}

export function shopStats(purchases: PurchaseView[], todayYmd: string) {
  const paid = purchases.filter((p) => p.status === "paid");
  const revenue = paid.reduce((s, p) => s + p.amount, 0);
  const months = lastMonths(todayYmd, 6).map((mo) => ({ ...mo, value: paid.filter((p) => p.createdAt.startsWith(mo.key)).reduce((s, p) => s + p.amount, 0) }));
  return { sales: paid.length, revenue, buyers: new Set(paid.map((p) => p.profileId)).size, months };
}

export function referralStats(refs: ReferralView[]) {
  const members = refs.filter((r) => r.status === "member").length;
  const toDeliver = refs.flatMap((r) => r.grants).filter((g) => g.status === "granted").length;
  const referrers = new Map<string, { name: string; total: number; members: number }>();
  for (const r of refs) {
    const x = referrers.get(r.referrerId) ?? { name: r.referrerName, total: 0, members: 0 };
    x.total += 1;
    if (r.status === "member") x.members += 1;
    referrers.set(r.referrerId, x);
  }
  return {
    total: refs.length,
    members,
    rate: refs.length ? Math.round((members / refs.length) * 100) : 0,
    toDeliver,
    topReferrers: [...referrers.values()].sort((a, b) => b.members - a.members || b.total - a.total).slice(0, 5),
  };
}
