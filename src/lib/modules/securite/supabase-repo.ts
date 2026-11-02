/**
 * Lot 6 — implémentation Supabase du SecuriteRepo (session de la personne : la RLS de 0008 s'applique).
 * La clé service n'est utilisée que pour lire les abonnements push des destinataires au moment de l'envoi.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "../../supabase/server";
import type { AuditEntry } from "../../types";
import type { SecuriteRepo } from "./repo";
import type { AccountSession, ConsentRecord, DeletionRequest, StoredPushSubscription } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const db = (): Promise<SupabaseClient> => supabaseServer();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toConsent(r: Row): ConsentRecord {
  return { id: str(r.id), profileId: str(r.profile_id), kind: r.kind as ConsentRecord["kind"], granted: Boolean(r.granted), source: str(r.source), createdAt: str(r.created_at) };
}

function toDeletion(r: Row): DeletionRequest {
  return {
    id: str(r.id),
    profileId: str(r.profile_id),
    reason: strN(r.reason),
    status: r.status as DeletionRequest["status"],
    requestedAt: str(r.requested_at),
    scheduledFor: str(r.scheduled_for),
    processedAt: strN(r.processed_at),
    processedBy: strN(r.processed_by),
    adminNote: strN(r.admin_note),
  };
}

function toAudit(r: Row): AuditEntry {
  return {
    id: str(r.id),
    actorId: strN(r.actor_id),
    action: r.action as AuditEntry["action"],
    targetType: r.target_type as AuditEntry["targetType"],
    targetId: strN(r.target_id),
    summary: str(r.summary),
    details: (r.details as Record<string, unknown>) ?? {},
    createdAt: str(r.created_at),
  };
}

function toPush(r: Row): StoredPushSubscription {
  return { id: str(r.id), profileId: str(r.profile_id), endpoint: str(r.endpoint), p256dh: str(r.p256dh), auth: str(r.auth), userAgent: strN(r.user_agent), createdAt: str(r.created_at) };
}

/** Échappe une valeur pour un filtre PostgREST `ilike` (les jokers deviennent littéraux). */
const likeValue = (s: string) => s.replace(/[\\%_,()*]/g, (c) => `\\${c}`);

export const supabaseSecuriteRepo: SecuriteRepo = {
  async listConsents(profileId) {
    const c = await db();
    return (check(await c.from("consents").select("*").eq("profile_id", profileId).order("seq", { ascending: false }).limit(500)) as Row[]).map(toConsent);
  },
  async recordConsent(profileId, kind, granted, source) {
    const c = await db();
    return toConsent(check(await c.from("consents").insert({ profile_id: profileId, kind, granted, source }).select("*").single()) as Row);
  },

  async getOpenDeletionRequest(profileId) {
    const c = await db();
    const r = check(await c.from("deletion_requests").select("*").eq("profile_id", profileId).eq("status", "pending").maybeSingle()) as Row | null;
    return r ? toDeletion(r) : null;
  },
  async listMyDeletionRequests(profileId) {
    const c = await db();
    return (check(await c.from("deletion_requests").select("*").eq("profile_id", profileId).order("requested_at", { ascending: false })) as Row[]).map(toDeletion);
  },
  async requestAccountDeletion(_profileId, reason) {
    const c = await db();
    return toDeletion(check(await c.rpc("request_account_deletion", { p_reason: reason })) as Row);
  },
  async cancelAccountDeletion() {
    const c = await db();
    return Boolean(check(await c.rpc("cancel_account_deletion")));
  },
  async listDeletionRequests() {
    const c = await db();
    return (check(await c.from("deletion_requests").select("*").order("requested_at", { ascending: false }).limit(500)) as Row[]).map(toDeletion);
  },
  async anonymizeAccount(profileId, requestId) {
    const c = await db();
    const res = await c.rpc("anonymize_account", { p_profile: profileId, p_request: requestId });
    if (res.error) {
      const m = res.error.message;
      if (m.includes("admin_account")) throw new Error("Un compte administratrice ne s’anonymise pas : retirez d’abord le rôle.");
      if (m.includes("not_self")) throw new Error("On ne s’anonymise pas soi-même.");
      if (m.includes("admin_only")) throw new Error("Réservé aux administratrices (avec double authentification).");
      throw new Error("Anonymisation impossible.");
    }
    // Compte de connexion : suppression « douce » (l'e-mail est libéré, la ligne reste pour les clés étrangères).
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { error } = await supabaseAdmin().auth.admin.deleteUser(profileId, true);
      if (error) console.error("[securite] suppression du compte de connexion :", error.message);
    }
  },
  async rejectDeletionRequest(requestId, actorId, note) {
    const c = await db();
    const r = check(
      await c
        .from("deletion_requests")
        .update({ status: "rejected", processed_at: new Date().toISOString(), processed_by: actorId, admin_note: note })
        .eq("id", requestId)
        .eq("status", "pending")
        .select("*")
        .maybeSingle(),
    ) as Row | null;
    return r ? toDeletion(r) : null;
  },

  async personalDataExtras(profileId) {
    const c = await db();
    const [memberships, messages, audit, push] = await Promise.all([
      c.from("memberships").select("*").eq("profile_id", profileId),
      c.from("messages").select("id, channel, body, created_at").eq("author_id", profileId).order("created_at").limit(5000),
      c.from("audit_log").select("*").or(`actor_id.eq.${profileId},target_id.eq.${profileId}`).order("created_at", { ascending: false }).limit(1000),
      c.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
    ]);
    return {
      memberships: (check(memberships) as Row[]) ?? [],
      authoredMessages: ((check(messages) as Row[]) ?? []).map((m) => ({ id: str(m.id), channel: str(m.channel), body: str(m.body), createdAt: str(m.created_at) })),
      // le journal n'est lisible que par les administratrices : vide pour une membre (RLS)
      auditAboutMe: audit.error ? [] : ((audit.data as Row[]) ?? []).map(toAudit),
      pushSubscriptions: push.count ?? 0,
    };
  },

  async savePushSubscription(profileId, sub) {
    const c = await db();
    check(
      await c
        .from("push_subscriptions")
        .upsert({ profile_id: profileId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_agent: sub.userAgent }, { onConflict: "endpoint" }),
    );
  },
  async deletePushSubscription(profileId, endpoint) {
    const c = await db();
    check(await c.from("push_subscriptions").delete().eq("profile_id", profileId).eq("endpoint", endpoint));
  },
  async countPushSubscriptions(profileId) {
    const c = await db();
    const res = await c.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", profileId);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async listPushSubscriptionsFor(profileIds) {
    const ids = profileIds.filter((x) => UUID_RE.test(x));
    if (!ids.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
    return (check(await supabaseAdmin().from("push_subscriptions").select("*").in("profile_id", ids)) as Row[]).map(toPush);
  },
  async removePushSubscriptionById(id) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    check(await supabaseAdmin().from("push_subscriptions").delete().eq("id", id));
  },

  async searchAudit(f) {
    const c = await db();
    let qy = c.from("audit_log").select("*").order("created_at", { ascending: false }).limit(Math.min(f.limit ?? 200, 5000));
    if (f.actorId && UUID_RE.test(f.actorId)) qy = qy.eq("actor_id", f.actorId);
    if (f.action) qy = f.action.includes(".") ? qy.eq("action", f.action) : qy.like("action", `${f.action}.%`);
    if (f.fromYmd) qy = qy.gte("created_at", `${f.fromYmd}T00:00:00+01:00`);
    if (f.toYmd) qy = qy.lte("created_at", `${f.toYmd}T23:59:59.999+01:00`);
    if (f.q) qy = qy.ilike("summary", `%${likeValue(f.q)}%`);
    return (check(await qy) as Row[]).map(toAudit);
  },
  async getAuditEntry(id) {
    if (!UUID_RE.test(id)) return null;
    const c = await db();
    const r = check(await c.from("audit_log").select("*").eq("id", id).maybeSingle()) as Row | null;
    return r ? toAudit(r) : null;
  },

  async listMySessions() {
    const c = await db();
    const res = await c.rpc("my_sessions");
    if (res.error) return [];
    return ((res.data as Row[]) ?? []).map(
      (r): AccountSession => ({ id: str(r.id), createdAt: str(r.created_at), updatedAt: strN(r.updated_at), userAgent: strN(r.user_agent), ip: strN(r.ip), aal: strN(r.aal) }),
    );
  },
  async getSecuritySettings() {
    const c = await db();
    const r = (await c.from("security_settings").select("admin_mfa_enforced").maybeSingle()).data as Row | null;
    return { adminMfaEnforced: Boolean(r?.admin_mfa_enforced) };
  },
  async setSecuritySettings(s, actorId) {
    const c = await db();
    check(await c.from("security_settings").update({ admin_mfa_enforced: s.adminMfaEnforced, updated_at: new Date().toISOString(), updated_by: actorId }).eq("id", true));
  },
};
