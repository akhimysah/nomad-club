/**
 * Statistiques du CRM (fonctions pures) : conversion, renouvellement, revenus, cohortes, retombées des deals.
 */
import { addDays, daysBetween, ymdOf } from "../../clock";
import { monthShortName } from "../../format";
import { hasRole } from "../../permissions";
import type { Payment, Profile } from "../../types";
import { SOURCE_LABEL, type ContactRow, type ContactSource, type CrmData, type DealOutcomeSource } from "./types";

export type MonthPoint = { ym: string; label: string };

export function lastMonths(today: string, n: number): MonthPoint[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = y * 12 + (m - 1) - (n - 1 - i);
    const yy = Math.floor(t / 12);
    const mm = (t % 12) + 1;
    return { ym: `${yy}-${String(mm).padStart(2, "0")}`, label: monthShortName(mm - 1) };
  });
}

export type CrmStats = {
  conversion: {
    total: number;
    won: number;
    lost: number;
    open: number;
    rate: number | null;
    bySource: Array<{ source: ContactSource; label: string; total: number; won: number; rate: number | null }>;
    byMonth: Array<MonthPoint & { created: number; won: number }>;
    lostReasons: Array<{ reason: string; count: number }>;
    openValue: number;
    wonValue: number;
  };
  renewal: { renewed: number; lapsed: number; rate: number | null; due30: number };
  revenue: {
    months: Array<MonthPoint & { adh: number; bil: number }>;
    byPlan: Array<{ label: string; amount: number; count: number }>;
    total12: number;
  };
  cohorts: Array<{ year: string; joined: number; active: number; rate: number }>;
  deals: { available: boolean; sample: boolean; total: number; count: number; months: Array<MonthPoint & { amount: number }>; bySector: Array<{ sector: string; amount: number }> };
};

const rate = (a: number, b: number) => (b > 0 ? a / b : null);

export function computeStats(input: { data: CrmData; rows: ContactRow[]; profiles: Profile[]; payments: Payment[]; today: string; outcomes: DealOutcomeSource }): CrmStats {
  const { data, rows, profiles, payments, today, outcomes } = input;
  const months12 = lastMonths(today, 12);
  const stageOf = new Map(data.stages.map((s) => [s.id, s]));
  const rowOf = new Map(rows.map((r) => [r.contact.id, r]));

  /* ----- conversion (pipeline) ----- */
  const deals = data.deals;
  const outcome = (stageId: string) => stageOf.get(stageId)?.outcome ?? "open";
  const won = deals.filter((d) => outcome(d.stageId) === "won");
  const lost = deals.filter((d) => outcome(d.stageId) === "lost");
  const openDeals = deals.filter((d) => outcome(d.stageId) === "open");
  const sources = new Map<ContactSource, { total: number; won: number }>();
  deals.forEach((d) => {
    const src = rowOf.get(d.contactId)?.contact.source ?? "autre";
    const s = sources.get(src) ?? { total: 0, won: 0 };
    s.total++;
    if (outcome(d.stageId) === "won") s.won++;
    sources.set(src, s);
  });
  const reasons = new Map<string, number>();
  lost.forEach((d) => {
    const r = (d.lostReason ?? "").trim() || "Sans motif";
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  });
  const conv6 = lastMonths(today, 6).map((m) => ({
    ...m,
    created: deals.filter((d) => ymdOf(d.createdAt).startsWith(m.ym)).length,
    won: won.filter((d) => d.closedAt && ymdOf(d.closedAt).startsWith(m.ym)).length,
  }));

  /* ----- renouvellement (12 derniers mois) ----- */
  const yearAgo = addDays(today, -365);
  const validated = payments.filter((p) => p.status === "validated" && p.validatedAt);
  const renewedIds = new Set(
    validated.filter((p) => p.kind === "membership" && p.membershipAction === "renew" && p.profileId && ymdOf(p.validatedAt!) >= yearAgo).map((p) => p.profileId!),
  );
  const lapsedIds = new Set(profiles.filter((p) => hasRole(p, "member") && p.planEndsAt && p.planEndsAt < today && p.planEndsAt >= yearAgo && !renewedIds.has(p.id)).map((p) => p.id));
  const due30 = profiles.filter((p) => hasRole(p, "member") && p.planEndsAt && p.planEndsAt >= today && daysBetween(today, p.planEndsAt) <= 30).length;

  /* ----- revenus ----- */
  const revMonths = months12.map((m) => {
    const inM = validated.filter((p) => ymdOf(p.validatedAt!).startsWith(m.ym));
    return {
      ...m,
      adh: inM.filter((p) => p.kind === "membership").reduce((a, p) => a + p.amount, 0),
      bil: inM.filter((p) => p.kind === "booking").reduce((a, p) => a + p.amount, 0),
    };
  });
  const in12 = validated.filter((p) => ymdOf(p.validatedAt!) >= months12[0].ym + "-01");
  const plan = (label: string, test: (p: Payment) => boolean) => {
    const l = in12.filter(test);
    return { label, amount: l.reduce((a, p) => a + p.amount, 0), count: l.length };
  };
  const byPlan = [
    plan("Adhésion Membre", (p) => p.kind === "membership" && p.plan === "member"),
    plan("Adhésion Premium", (p) => p.kind === "membership" && p.plan === "premium"),
    plan("Billets", (p) => p.kind === "booking"),
  ];

  /* ----- cohortes : année d'arrivée → encore adhérentes aujourd'hui ----- */
  const members = profiles.filter((p) => hasRole(p, "member") && p.plan !== "free");
  const years = [...new Set(members.map((p) => p.createdAt.slice(0, 4)))].sort();
  const cohorts = years.map((y) => {
    const c = members.filter((p) => p.createdAt.startsWith(y));
    const active = c.filter((p) => p.planEndsAt && p.planEndsAt >= today).length;
    return { year: y, joined: c.length, active, rate: c.length ? active / c.length : 0 };
  });

  /* ----- retombées des deals (Espace Business) ----- */
  const dealMonths = months12.map((m) => ({ ...m, amount: outcomes.rows.filter((r) => r.month === m.ym).reduce((a, r) => a + r.amount, 0) }));
  const sectors = new Map<string, number>();
  outcomes.rows.forEach((r) => sectors.set(r.sector, (sectors.get(r.sector) ?? 0) + r.amount));

  return {
    conversion: {
      total: deals.length,
      won: won.length,
      lost: lost.length,
      open: openDeals.length,
      rate: rate(won.length, won.length + lost.length),
      bySource: [...sources.entries()]
        .map(([source, s]) => ({ source, label: SOURCE_LABEL[source], total: s.total, won: s.won, rate: rate(s.won, s.total) }))
        .sort((a, b) => b.total - a.total),
      byMonth: conv6,
      lostReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      openValue: openDeals.reduce((a, d) => a + d.value, 0),
      wonValue: won.reduce((a, d) => a + d.value, 0),
    },
    renewal: { renewed: renewedIds.size, lapsed: lapsedIds.size, rate: rate(renewedIds.size, renewedIds.size + lapsedIds.size), due30 },
    revenue: { months: revMonths, byPlan, total12: revMonths.reduce((a, m) => a + m.adh + m.bil, 0) },
    cohorts,
    deals: {
      available: outcomes.available,
      sample: outcomes.sample,
      total: outcomes.rows.reduce((a, r) => a + r.amount, 0),
      count: outcomes.rows.length,
      months: dealMonths,
      bySector: [...sectors.entries()].map(([sector, amount]) => ({ sector, amount })).sort((a, b) => b.amount - a.amount),
    },
  };
}

/** Graduation « ronde » d'un axe (0, 500, 1 000…) pour des barres à l'échelle. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}
