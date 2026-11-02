/**
 * Envois déclenchés hors notifications (appelés par les actions, le retour du lien magique et le cron).
 * Chaque fonction est sûre : une erreur est journalisée, jamais remontée à l'action appelante.
 */
import { addDays, today, TZ } from "../../clock";
import { getRepo } from "../../data";
import { isRealMode } from "../../env";
import { PLAN_LABEL } from "../../format";
import type { Profile } from "../../types";
import { isEmailAddress } from "./config";
import { emailLogStore } from "./log-store";
import { sendTemplate, type SendOutcome } from "./service";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const longDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(":", " h ");

async function safely(label: string, fn: () => Promise<SendOutcome | null>): Promise<boolean> {
  try {
    const r = await fn();
    return Boolean(r?.ok);
  } catch (e) {
    console.error(`[e-mails] ${label} :`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** Bienvenue : une seule fois, à la première connexion d'un compte créé il y a moins de 24 h. */
export function sendWelcomeIfNew(user: { id: string; email?: string | null; created_at?: string | null }, firstName = ""): Promise<boolean> {
  return safely("bienvenue", async () => {
    if (!user.email || !isEmailAddress(user.email)) return null;
    const created = user.created_at ? Date.parse(user.created_at) : NaN;
    if (!Number.isFinite(created) || Date.now() - created > 24 * 3600000) return null;
    if (await emailLogStore().hasSent("welcome", user.id)) return null;
    return sendTemplate({ template: "welcome", to: user.email, data: { firstName } }, { profileId: user.id });
  });
}

export function sendDeletionScheduled(p: Profile, scheduledForIso: string): Promise<boolean> {
  return safely("suppression programmée", async () =>
    p.email ? sendTemplate({ template: "account_deletion_scheduled", to: p.email, data: { firstName: p.firstName, scheduledFor: longDate(scheduledForIso) } }, { profileId: p.id }) : null,
  );
}

/** Après anonymisation : l'adresse n'est pas gardée dans le journal. */
export function sendAccountDeleted(email: string | null, firstName: string): Promise<boolean> {
  return safely("compte supprimé", async () =>
    email ? sendTemplate({ template: "account_deleted", to: email, data: { firstName, deletedAt: longDate(new Date().toISOString()) } }, { forget: true }) : null,
  );
}

export function sendDataExportReady(p: Profile): Promise<boolean> {
  return safely("export de données", async () =>
    p.email ? sendTemplate({ template: "data_export_ready", to: p.email, data: { firstName: p.firstName, requestedAt: longDateTime(new Date().toISOString()) } }, { profileId: p.id }) : null,
  );
}

export function sendTeamInvite(input: { email: string; inviterName: string; organizationName: string; kind: "partner" | "pro"; joinedProfileId: string | null }): Promise<boolean> {
  return safely("invitation d’équipe", async () => {
    const space = input.kind === "pro" ? "/pro" : "/partenaire";
    return sendTemplate(
      {
        template: "team_invite",
        to: input.email,
        data: {
          inviterName: input.inviterName,
          organizationName: input.organizationName,
          spaceLabel: input.kind === "pro" ? "pro" : "partenaire",
          joined: Boolean(input.joinedProfileId),
          acceptUrl: input.joinedProfileId ? space : `/connexion?suite=${encodeURIComponent(space)}`,
        },
      },
      { profileId: input.joinedProfileId },
    );
  });
}

/** Relance manuelle des fondatrices (renouvellement, adhésion échue, billets impayés). */
export function sendFounderReminder(profileId: string | null, category: string): Promise<boolean> {
  return safely("relance", async () => {
    if (!profileId || (category !== "renew" && category !== "lapsed" && category !== "unpaid")) return null;
    const p = await getRepo().getProfile(profileId);
    if (!p?.email) return null;
    if (category === "unpaid")
      return sendTemplate({ template: "payment_failed", to: p.email, data: { firstName: p.firstName, label: "ta réservation en attente de paiement", payUrl: "/espace/agenda" } }, { profileId: p.id });
    const ends = p.planEndsAt;
    const daysLeft = ends ? Math.round((Date.parse(ends) - Date.parse(today())) / 86400000) : 0;
    return sendTemplate(
      {
        template: "renewal_reminder",
        to: p.email,
        data: { firstName: p.firstName, planLabel: p.plan === "free" ? "Membre" : PLAN_LABEL[p.plan], endsOn: ends ? longDate(ends + "T12:00:00Z") : "", daysLeft: Math.max(daysLeft, 0) },
      },
      { profileId: p.id },
    );
  });
}

export type RenewalRun = { sent: number; skipped: number; days: Record<string, number> };

/** Rappels automatiques de renouvellement J-30, J-7 et J-1 (cron quotidien), une fois par échéance. */
export async function sendRenewalReminders(offsets: readonly number[] = [30, 7, 1]): Promise<RenewalRun> {
  const run: RenewalRun = { sent: 0, skipped: 0, days: {} };
  const t = today();
  const targets = new Map(offsets.map((d) => [addDays(t, d), d]));
  type Target = { id: string; email: string | null; firstName: string; plan: string; planEndsAt: string | null };
  let people: Target[] = [];
  if (isRealMode()) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return run;
    const { supabaseAdmin } = await import("../../supabase/server");
    const { data } = await supabaseAdmin().from("profiles").select("id, email, first_name, plan, plan_ends_at").neq("plan", "free").in("plan_ends_at", [...targets.keys()]);
    people = ((data ?? []) as Array<{ id: string; email: string | null; first_name: string | null; plan: string; plan_ends_at: string | null }>).map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.first_name ?? "",
      plan: r.plan,
      planEndsAt: r.plan_ends_at,
    }));
  } else {
    people = (await getRepo().listProfiles()).filter((p) => p.plan !== "free" && p.planEndsAt && targets.has(p.planEndsAt));
  }
  const store = emailLogStore();
  for (const p of people) {
    const days = p.planEndsAt ? targets.get(p.planEndsAt) : undefined;
    if (days === undefined || !p.email) continue;
    const dedupeKey = `${p.planEndsAt}:J-${days}`;
    if (await store.hasSent("renewal_reminder", p.id, { key: "dedupeKey", value: dedupeKey })) {
      run.skipped++;
      continue;
    }
    const r = await sendTemplate(
      {
        template: "renewal_reminder",
        to: p.email,
        data: { firstName: p.firstName, planLabel: p.plan === "premium" ? "Premium" : "Membre", endsOn: longDate(p.planEndsAt + "T12:00:00Z"), daysLeft: days, dedupeKey },
      },
      { profileId: p.id, idempotencyKey: `renewal:${p.id}:${dedupeKey}` },
    );
    if (r.ok) {
      run.sent++;
      run.days[`J-${days}`] = (run.days[`J-${days}`] ?? 0) + 1;
    }
  }
  return run;
}

/** Purge du journal (mode réel, clé service). */
export async function purgeEmailLog(days = 180): Promise<number> {
  if (!isRealMode() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const { supabaseAdmin } = await import("../../supabase/server");
  const { data, error } = await supabaseAdmin().rpc("purge_email_log", { p_days: days });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
