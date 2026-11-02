/**
 * Tableau de bord des fondatrices, entièrement recalculé depuis les données.
 * Fonctions pures : utilisées à l'identique par le mode démo et le mode réel.
 */
import { addDays, daysBetween, ymdInTz, ymdOf } from "../clock";
import { PRICES } from "../content";
import { dayLong, dayMonthShort, fullName, monthShortName, PLAN_LABEL, ymdShort, ymdShortYear } from "../format";
import type { Booking, ClubEvent, EventStats, Payment, Profile, Reminder, ReminderReason } from "../types";
import { eventGroupLabel, eventStats } from "./events";
import { hasRole, isAdmin, isGuest } from "../permissions";

export type Snapshot = {
  profiles: Profile[];
  events: ClubEvent[];
  bookings: Booking[];
  payments: Payment[];
  reminders: Reminder[];
};

export type RelCat = "renew" | "lapsed" | "unpaid" | "free";

export type TodoVir = { id: string; name: string; what: string; date: string; amount: number; kind: "adh" | "bil" };
export type TodoRel = {
  /** Clé d'action : « renew:<profil> », « lapsed:<profil> », « unpaid:<événement> », « free:<profil> ». */
  key: string;
  cat: RelCat;
  name: string;
  profileId: string | null;
  isEvent: boolean;
  what: string;
  when: string;
  last: string;
  amount: number;
  urgent: boolean;
  dueAt: string;
};
export type TodoDraft = { id: string; title: string; date: string; venue: string | null; capacity: number };

export type EventFill = { event: ClubEvent; stats: EventStats };

export type MemberStatus = "active" | "renew" | "lapsed" | "pending" | "free" | "done";
export type MemberRow = {
  profile: Profile;
  name: string;
  formule: string;
  status: MemberStatus;
  due: string;
  action: { type: "vir"; id: string } | { type: "rel"; key: string; label: string } | null;
};

export type Dashboard = {
  today: string;
  vir: TodoVir[];
  rel: TodoRel[];
  drafts: TodoDraft[];
  counts: { vir: number; renew: number; lapsed: number; unpaid: number; free: number; draft: number };
  total: number;
  urgent: number;
  activeMembers: number;
  premiumMembers: number;
  newIn12Months: number;
  pendingMemberships: number;
  growth: number[];
  cashThisMonth: number;
  prevMonth: { label: string; total: number };
  renew30: { count: number; amount: number; reminded: number };
  months: Array<{ ym: string; label: string; adh: number; bil: number; current: boolean }>;
  yearTotal: number;
  auto: {
    sent30: number;
    noAnswer: Array<{ name: string; reason: string; daysAgo: number }>;
    scheduled: Array<{ date: string; name: string; label: string }>;
  };
  dues: Array<{ label: string; count: number }>;
  duesTotal: number;
  duesUntil: string;
  fills: EventFill[];
  draftFills: TodoDraft[];
  recent: Array<{ date: string; label: string; amount: number }>;
  members: MemberRow[];
  totalProfiles: number;
};

const REASON_LABEL: Record<ReminderReason, string> = {
  renewal: "renouvellement",
  expired: "adhésion échue",
  unpaid: "billet impayé",
  invite: "invitation",
};

/** Une relance envoyée il y a moins de 3 jours met l'élément en « traité ». */
const QUIET_DAYS = 3;

function ymOf(ymd: string) {
  return ymd.slice(0, 7);
}

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function lastDayOfYm(ym: string): string {
  return addDays(shiftYm(ym, 1) + "-01", -1);
}

export function isActiveMember(p: Profile, today: string): boolean {
  return hasRole(p, "member") && p.plan !== "free" && !!p.planEndsAt && p.planEndsAt >= today;
}

export function computeDashboard(s: Snapshot, nowMs: number): Dashboard {
  const today = ymdInTz(nowMs);
  const ym = ymOf(today);
  const byId = new Map(s.profiles.map((p) => [p.id, p]));
  const evById = new Map(s.events.map((e) => [e.id, e]));
  const bookingById = new Map(s.bookings.map((b) => [b.id, b]));

  const sentReminders = s.reminders.filter((r) => r.sentAt);
  const lastSent = (reason: ReminderReason, profileId: string | null, eventId: string | null) =>
    sentReminders
      .filter((r) => r.reason === reason && r.profileId === profileId && r.eventId === eventId)
      .sort((a, b) => (a.sentAt! < b.sentAt! ? 1 : -1))[0];
  const recentlySent = (r: Reminder | undefined) => !!r && daysBetween(ymdOf(r.sentAt!), today) < QUIET_DAYS;

  /* ----- virements à valider ----- */
  // Virements déclarés uniquement : un paiement carte « declared » est un passage Stripe pas encore confirmé.
  const declared = s.payments.filter((p) => p.status === "declared" && p.method === "transfer");
  const pendingMembershipBy = new Map<string, Payment>();
  declared.forEach((p) => {
    if (p.kind === "membership" && p.profileId) pendingMembershipBy.set(p.profileId, p);
  });
  const declaredBookingIds = new Set(declared.filter((p) => p.bookingId).map((p) => p.bookingId!));
  const vir: TodoVir[] = declared
    .sort((a, b) => (a.declaredAt < b.declaredAt ? 1 : -1))
    .map((p) => {
      let what = p.plan ? `Adhésion ${PLAN_LABEL[p.plan]}` : "Adhésion";
      if (p.kind === "booking") {
        const b = p.bookingId ? bookingById.get(p.bookingId) : undefined;
        const e = b ? evById.get(b.eventId) : undefined;
        what = `Billet · ${e?.title ?? "rendez-vous"}`;
      } else if (p.membershipAction === "upgrade") what = "Passage à Premium";
      return { id: p.id, name: p.payerName, what, date: `déclaré le ${ymdShort(ymdOf(p.declaredAt))}`, amount: p.amount, kind: p.kind === "membership" ? "adh" : "bil" };
    });

  /* ----- relances ----- */
  const rel: TodoRel[] = [];
  const members = s.profiles.filter((p) => hasRole(p, "member"));
  for (const p of members) {
    if (!p.planEndsAt || p.plan === "free" || pendingMembershipBy.has(p.id)) continue;
    const name = fullName(p);
    const price = p.plan === "premium" ? PRICES.premium : PRICES.member;
    const d = daysBetween(today, p.planEndsAt);
    if (d >= 0 && d <= 30) {
      const last = lastSent("renewal", p.id, null);
      if (recentlySent(last)) continue;
      rel.push({
        key: `renew:${p.id}`, cat: "renew", name, profileId: p.id, isEvent: false,
        what: `Renouvellement ${PLAN_LABEL[p.plan]} · échéance le ${ymdShort(p.planEndsAt)}`,
        when: d === 0 ? "aujourd’hui" : `dans ${d} j`,
        last: last ? `relancée le ${ymdShort(ymdOf(last.sentAt!))}` : "jamais relancée",
        amount: price, urgent: d <= 7, dueAt: p.planEndsAt,
      });
    } else if (d < 0 && d >= -60) {
      const last = lastSent("expired", p.id, null);
      if (recentlySent(last)) continue;
      rel.push({
        key: `lapsed:${p.id}`, cat: "lapsed", name, profileId: p.id, isEvent: false,
        what: `Adhésion ${PLAN_LABEL[p.plan]} échue le ${ymdShort(p.planEndsAt)}`,
        when: "échue",
        last: last ? `relancée il y a ${daysBetween(ymdOf(last.sentAt!), today)} j` : "jamais relancée",
        amount: price, urgent: false, dueAt: p.planEndsAt,
      });
    }
  }
  // billets impayés, groupés par rendez-vous à venir
  const upcoming = s.events.filter((e) => e.status === "published" && ymdOf(e.startsAt) >= today);
  for (const e of upcoming) {
    const unpaid = s.bookings.filter((b) => b.eventId === e.id && b.status === "pending" && !declaredBookingIds.has(b.id));
    if (!unpaid.length) continue;
    const last = lastSent("unpaid", null, e.id);
    if (recentlySent(last)) continue;
    const names = unpaid.map((b) => (b.profileId ? fullName(byId.get(b.profileId) ?? { firstName: "?", lastName: "" }) : b.guestFirstName ?? "Invitée"));
    const d = daysBetween(today, ymdOf(e.startsAt));
    rel.push({
      key: `unpaid:${e.id}`, cat: "unpaid", name: eventGroupLabel(e, dayMonthShort(e.startsAt)), profileId: null, isEvent: true,
      what: `${unpaid.length} impayée${unpaid.length > 1 ? "s" : ""} : ${names.join(", ")}`,
      when: `dans ${d} j`,
      last: last ? `relancées le ${ymdShort(ymdOf(last.sentAt!))}` : unpaid.length > 1 ? "billets réservés" : "billet réservé",
      amount: unpaid.reduce((a, b) => a + b.amount, 0), urgent: d <= 14, dueAt: ymdOf(e.startsAt),
    });
  }
  // comptes gratuits à faire adhérer
  for (const p of s.profiles.filter(isGuest)) {
    const last = lastSent("invite", p.id, null);
    if (last) continue;
    const n = s.bookings.filter((b) => b.profileId === p.id && b.status === "paid").length;
    const created = ymdOf(p.createdAt);
    rel.push({
      key: `free:${p.id}`, cat: "free", name: fullName(p), profileId: p.id, isEvent: false,
      what: n ? `Compte gratuit · ${n} rendez-vous au tarif public` : `Compte gratuit · inscrite en ${monthLong(created)}`,
      when: "à inviter", last: "jamais contactée", amount: 0, urgent: false, dueAt: "9999-12-31",
    });
  }
  rel.sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.urgent) return a.dueAt < b.dueAt ? -1 : 1;
    if (a.amount !== b.amount) return b.amount - a.amount;
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  });

  /* ----- brouillons ----- */
  const drafts: TodoDraft[] = s.events
    .filter((e) => e.status === "draft")
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
    .map((e) => ({ id: e.id, title: e.title, date: dayLong(e.startsAt), venue: e.venue, capacity: e.capacity }));

  const counts = {
    vir: vir.length,
    renew: rel.filter((r) => r.cat === "renew").length,
    lapsed: rel.filter((r) => r.cat === "lapsed").length,
    unpaid: rel.filter((r) => r.cat === "unpaid").length,
    free: rel.filter((r) => r.cat === "free").length,
    draft: drafts.length,
  };
  const total = vir.length + rel.length + drafts.length;
  const urgent = vir.length + rel.filter((r) => r.urgent).length;

  /* ----- adhérentes ----- */
  const active = s.profiles.filter((p) => isActiveMember(p, today));
  const yearAgo = addDays(today, -365);
  const growth: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = i === 0 ? today : lastDayOfYm(shiftYm(ym, -i));
    growth.push(active.filter((p) => ymdOf(p.createdAt) <= end).length);
  }

  /* ----- encaissements ----- */
  const validated = s.payments.filter((p) => p.status === "validated" && p.validatedAt);
  const months: Dashboard["months"] = [];
  for (let i = 11; i >= 0; i--) {
    const m = shiftYm(ym, -i);
    const inMonth = validated.filter((p) => ymOf(ymdOf(p.validatedAt!)) === m);
    months.push({
      ym: m,
      label: monthShortName(Number(m.slice(5, 7)) - 1),
      adh: inMonth.filter((p) => p.kind === "membership").reduce((a, p) => a + p.amount, 0),
      bil: inMonth.filter((p) => p.kind === "booking").reduce((a, p) => a + p.amount, 0),
      current: i === 0,
    });
  }
  const prev = months[10];
  const renewSoon = active.filter((p) => daysBetween(today, p.planEndsAt!) <= 30);

  /* ----- relances automatiques ----- */
  const sent30 = sentReminders.filter((r) => daysBetween(ymdOf(r.sentAt!), today) <= 30);
  const seen = new Set<string>();
  const noAnswer = sent30
    .filter((r) => !r.answered)
    .sort((a, b) => (a.sentAt! < b.sentAt! ? 1 : -1))
    .filter((r) => {
      const k = r.profileId ?? "e:" + r.eventId;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((r) => ({
      name: r.profileId ? fullName(byId.get(r.profileId) ?? { firstName: "?", lastName: "" }) : evById.get(r.eventId ?? "")?.title ?? "Rendez-vous",
      reason: REASON_LABEL[r.reason],
      daysAgo: daysBetween(ymdOf(r.sentAt!), today),
    }));
  const scheduled = s.reminders
    .filter((r) => !r.sentAt && r.scheduledFor && r.scheduledFor >= today && daysBetween(today, r.scheduledFor) <= 14)
    .filter((r) => {
      if (r.reason !== "renewal" || !r.profileId) return true;
      return byId.get(r.profileId)?.planEndsAt === r.dueAt; // déjà renouvelée : plus de relance
    })
    .sort((a, b) => (a.scheduledFor! < b.scheduledFor! ? -1 : 1))
    .map((r) => {
      const diff = r.dueAt ? daysBetween(r.scheduledFor!, r.dueAt) : 0;
      const label = diff >= 25 ? "un mois avant" : diff >= 6 && diff <= 8 ? "une semaine avant" : diff === 1 ? "la veille" : diff > 0 ? `${diff} j avant` : `J+${-diff}`;
      return { date: ymdShort(r.scheduledFor!), name: r.profileId ? fullName(byId.get(r.profileId) ?? { firstName: "?", lastName: "" }) : "Rendez-vous", label };
    });

  /* ----- échéances ----- */
  const dues = Array.from({ length: 6 }, (_, i) => {
    const m = shiftYm(ym, i);
    return { label: monthShortName(Number(m.slice(5, 7)) - 1), count: active.filter((p) => ymOf(p.planEndsAt!) === m).length };
  });

  /* ----- remplissage ----- */
  const fills = upcoming.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1)).map((e) => ({ event: e, stats: eventStats(e, s.bookings) }));

  /* ----- derniers encaissements ----- */
  const recent = validated
    .sort((a, b) => (a.validatedAt! < b.validatedAt! ? 1 : -1))
    .slice(0, 6)
    .map((p) => {
      let label = p.plan ? `Adhésion ${PLAN_LABEL[p.plan]}` : "Adhésion";
      if (p.kind === "booking") {
        const b = p.bookingId ? bookingById.get(p.bookingId) : undefined;
        const e = b ? evById.get(b.eventId) : undefined;
        label = e ? `Billet ${e.title}` : "Billet";
      }
      return { date: ymdShort(ymdOf(p.validatedAt!)), label: `${p.payerName} · ${label}`, amount: p.amount };
    });

  /* ----- fiches membres ----- */
  const relByProfile = new Map(rel.filter((r) => r.profileId).map((r) => [r.profileId!, r]));
  const virByProfile = new Map(
    declared.filter((p) => p.profileId).map((p) => [p.profileId!, p] as const),
  );
  const memberRows: MemberRow[] = s.profiles
    .filter((p) => !isAdmin(p) && (hasRole(p, "member") || isGuest(p)))
    .map((p) => {
      const pend = pendingMembershipBy.get(p.id);
      const r = relByProfile.get(p.id);
      const v = virByProfile.get(p.id);
      let status: MemberStatus;
      if (pend) status = "pending";
      else if (isGuest(p)) status = r ? "free" : "done";
      else if (!p.planEndsAt || p.planEndsAt < today) status = r ? "lapsed" : recentlySent(lastSent("expired", p.id, null)) ? "done" : "lapsed";
      else if (daysBetween(today, p.planEndsAt) <= 30) status = r ? "renew" : "done";
      else status = "active";
      const formule = pend?.plan ? PLAN_LABEL[pend.plan] : PLAN_LABEL[isGuest(p) ? "free" : p.plan];
      const due = pend ? "virement déclaré" : isGuest(p) ? "—" : p.planEndsAt ? ymdShortYear(p.planEndsAt) : "—";
      const action: MemberRow["action"] = v
        ? { type: "vir", id: v.id }
        : r
          ? { type: "rel", key: r.key, label: r.cat === "free" ? "Inviter" : "Relancer" }
          : null;
      return { profile: p, name: fullName(p), formule, status, due, action };
    });
  const ORDER: Record<MemberStatus, number> = { pending: 0, renew: 1, lapsed: 2, done: 3, active: 4, free: 5 };
  memberRows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.profile.planEndsAt ?? "") .localeCompare(b.profile.planEndsAt ?? "") || a.name.localeCompare(b.name, "fr"));

  const duesTotal = dues.reduce((a, d) => a + d.count, 0);
  return {
    today,
    vir,
    rel,
    drafts,
    counts,
    total,
    urgent,
    activeMembers: active.length,
    premiumMembers: active.filter((p) => p.plan === "premium").length,
    newIn12Months: active.filter((p) => ymdOf(p.createdAt) >= yearAgo).length,
    pendingMemberships: declared.filter((p) => p.kind === "membership").length,
    growth,
    cashThisMonth: months[11].adh + months[11].bil,
    prevMonth: { label: monthLong(prev.ym + "-01"), total: prev.adh + prev.bil },
    renew30: {
      count: renewSoon.length,
      amount: renewSoon.reduce((a, p) => a + (p.plan === "premium" ? PRICES.premium : PRICES.member), 0),
      reminded: renewSoon.filter((p) => sentReminders.some((r) => r.reason === "renewal" && r.profileId === p.id && r.dueAt === p.planEndsAt)).length,
    },
    months,
    yearTotal: months.reduce((a, m) => a + m.adh + m.bil, 0),
    auto: { sent30: sent30.length, noAnswer, scheduled },
    dues,
    duesTotal,
    duesUntil: monthLong(shiftYm(ym, 5) + "-01"),
    fills,
    draftFills: drafts.filter((d) => d.venue),
    recent,
    members: memberRows,
    totalProfiles: s.profiles.length,
  };
}

const LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function monthLong(ymd: string): string {
  return LONG[Number(ymd.slice(5, 7)) - 1];
}
