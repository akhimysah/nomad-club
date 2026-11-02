/**
 * Vague 2 — Inscription et lancement : implémentation Supabase (session + RLS ; les écritures passent par
 * les fonctions SQL de 0012_lancement.sql, qui notifient, journalisent et notent au CRM elles-mêmes).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "../../supabase/server";
import { friendly } from "./domain";
import type { LancementRepo } from "./repo";
import { HEARD_FROM } from "./types";
import type { ApplicationView, HeardFrom, InvitationState, LancementSettings, MembershipApplication, Onboarding, OnboardingStep, RoleInvitation } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));
const db = (): Promise<SupabaseClient> => supabaseServer();

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendly(res.error.message));
  return res.data;
}

const heard = (v: unknown): HeardFrom | null => ((HEARD_FROM as readonly string[]).includes(str(v)) ? (str(v) as HeardFrom) : null);

function toOnboarding(r: Row): Onboarding {
  return {
    profileId: str(r.profile_id),
    heardFrom: heard(r.heard_from),
    heardFromDetail: strN(r.heard_from_detail),
    signupPath: r.signup_path === "apply" ? "apply" : "free",
    referralCode: strN(r.referral_code),
    termsVersion: strN(r.terms_version),
    termsAcceptedAt: strN(r.terms_accepted_at),
    stepsDone: ((r.steps_done as string[] | null) ?? []) as OnboardingStep[],
    completedAt: strN(r.completed_at),
    skippedAt: strN(r.skipped_at),
    createdAt: str(r.created_at),
  };
}

function toApplication(r: Row): MembershipApplication {
  return {
    id: str(r.id),
    profileId: str(r.profile_id),
    job: str(r.job),
    company: strN(r.company),
    marrakechSince: str(r.marrakech_since),
    motivation: str(r.motivation),
    status: r.status as MembershipApplication["status"],
    decisionMessage: strN(r.decision_message),
    decidedBy: strN(r.decided_by),
    decidedAt: strN(r.decided_at),
    createdAt: str(r.created_at),
  };
}

function stateOf(r: Row): InvitationState {
  if (r.accepted_at) return "used";
  if (r.revoked_at) return "revoked";
  if (new Date(str(r.expires_at)).getTime() < Date.now()) return "expired";
  return "open";
}

function toSettings(r: Row | null): LancementSettings {
  return { membershipMode: r?.membership_mode === "direct" ? "direct" : "validation", termsVersion: str(r?.terms_version) || "inconnue", updatedAt: strN(r?.updated_at) };
}

export const lancementSupabaseRepo: LancementRepo = {
  async getLancementSettings() {
    const c = await db();
    return toSettings(check(await c.from("lancement_settings").select("*").eq("id", 1).maybeSingle()) as Row | null);
  },
  async setMembershipMode(mode, actorId) {
    const c = await db();
    return toSettings(check(await c.from("lancement_settings").update({ membership_mode: mode, updated_at: new Date().toISOString(), updated_by: actorId }).eq("id", 1).select("*").single()) as Row);
  },

  async getOnboarding() {
    const c = await db();
    return toOnboarding(check(await c.rpc("my_onboarding")) as Row);
  },
  async acceptTerms(_profileId, ip) {
    const c = await db();
    return toOnboarding(check(await c.rpc("accept_terms", { p_ip: ip })) as Row);
  },
  async onboardingProgress(_profileId, step, finish) {
    const c = await db();
    return toOnboarding(check(await c.rpc("onboarding_progress", { p_step: step, p_finish: finish })) as Row);
  },

  async submitApplication(_profileId, input) {
    const c = await db();
    return toApplication(
      check(await c.rpc("submit_membership_application", { p_job: input.job, p_company: input.company, p_marrakech_since: input.marrakechSince, p_motivation: input.motivation })) as Row,
    );
  },
  async withdrawApplication() {
    const c = await db();
    return Boolean(check(await c.rpc("withdraw_membership_application")));
  },
  async listMyApplications(profileId) {
    const c = await db();
    return (check(await c.from("membership_applications").select("*").eq("profile_id", profileId).order("created_at", { ascending: false })) as Row[]).map(toApplication);
  },
  async listApplications() {
    const c = await db();
    const rows = check(await c.from("membership_applications").select("*").order("created_at", { ascending: false }).limit(500)) as Row[];
    const ids = [...new Set(rows.flatMap((r) => [str(r.profile_id), str(r.decided_by)]).filter(Boolean))];
    const [profiles, onboarding] = await Promise.all([
      ids.length ? c.from("profiles").select("id, first_name, last_name, email, whatsapp, country").in("id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? c.from("member_onboarding").select("profile_id, heard_from").in("profile_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const byId = new Map((check(profiles) as Row[]).map((p) => [str(p.id), p]));
    const heardBy = new Map((check(onboarding) as Row[]).map((o) => [str(o.profile_id), heard(o.heard_from)]));
    return rows.map((r): ApplicationView => {
      const p = byId.get(str(r.profile_id));
      const by = r.decided_by ? byId.get(str(r.decided_by)) : null;
      return {
        ...toApplication(r),
        name: p ? [str(p.first_name), str(p.last_name)].filter(Boolean).join(" ") : "Compte supprimé",
        email: strN(p?.email),
        whatsapp: strN(p?.whatsapp),
        country: strN(p?.country),
        heardFrom: heardBy.get(str(r.profile_id)) ?? null,
        decidedByName: by ? str(by.first_name) : null,
      };
    });
  },
  async decideApplication(id, accept, message) {
    const c = await db();
    return toApplication(check(await c.rpc("decide_membership_application", { p_application: id, p_accept: accept, p_message: message })) as Row);
  },
  async canJoinMembership() {
    const c = await db();
    return Boolean(check(await c.rpc("can_join_membership")));
  },

  async createRoleInvitation(input) {
    const c = await db();
    const j = check(await c.rpc("create_role_invitation", { p_email: input.email, p_role: input.role, p_organization: input.organizationId, p_note: input.note })) as Row;
    return { id: str(j.id), token: str(j.token), expiresAt: str(j.expires_at) };
  },
  async listRoleInvitations() {
    const c = await db();
    const rows = check(await c.from("role_invitations").select("id, email, role, organization_id, note, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at").order("created_at", { ascending: false }).limit(200)) as Row[];
    return rows.map(
      (r): RoleInvitation => ({
        id: str(r.id),
        email: str(r.email),
        role: r.role as RoleInvitation["role"],
        organizationId: strN(r.organization_id),
        note: strN(r.note),
        invitedBy: strN(r.invited_by),
        createdAt: str(r.created_at),
        expiresAt: str(r.expires_at),
        acceptedAt: strN(r.accepted_at),
        acceptedBy: strN(r.accepted_by),
        revokedAt: strN(r.revoked_at),
        state: stateOf(r),
      }),
    );
  },
  async revokeRoleInvitation(id) {
    const c = await db();
    return Boolean(check(await c.rpc("revoke_role_invitation", { p_invitation: id })));
  },
  async previewRoleInvitation(token) {
    const c = await db();
    const j = check(await c.rpc("role_invitation_preview", { p_token: token })) as Row | null;
    if (!j) return null;
    return { role: j.role as RoleInvitation["role"], emailHint: str(j.email_hint), organization: strN(j.organization), state: j.state as InvitationState };
  },
  async acceptRoleInvitation(token) {
    const c = await db();
    const j = check(await c.rpc("accept_role_invitation", { p_token: token })) as Row;
    return { role: j.role as RoleInvitation["role"], organizationId: strN(j.organization_id) };
  },
};
