/**
 * Lot 6 — implémentation « démo » (mémoire du processus) du SecuriteRepo.
 * Les données propres au module vivent dans leur propre magasin ; l'anonymisation et l'export
 * lisent et modifient le jeu de démo principal (globalThis.__nomadDemoDb, voir src/lib/data/demo-repo.ts).
 */
import { randomUUID } from "node:crypto";
import { nowIso, nowMs } from "../../clock";
import { createSeed, type SeedData } from "../../seed";
import type { AuditEntry } from "../../types";
import type { SecuriteRepo } from "./repo";
import { createSecuriteSeed, type SecuriteSeed } from "./seed";
import { auditMatches } from "./audit-view";
import { GRACE_DAYS } from "./consents";

type G = typeof globalThis & { __nomadDemoDb?: SeedData; __nomadSecuriteDb?: SecuriteSeed };

function core(): SeedData {
  const g = globalThis as G;
  if (!g.__nomadDemoDb) g.__nomadDemoDb = createSeed();
  return g.__nomadDemoDb;
}

function sdb(): SecuriteSeed {
  const g = globalThis as G;
  if (!g.__nomadSecuriteDb) g.__nomadSecuriteDb = createSecuriteSeed();
  return g.__nomadSecuriteDb;
}

const clone = <T>(v: T): T => structuredClone(v);

export const demoSecuriteRepo: SecuriteRepo = {
  async listConsents(profileId) {
    return clone(sdb().consents.filter((c) => c.profileId === profileId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  },
  async recordConsent(profileId, kind, granted, source) {
    const rec = { id: randomUUID(), profileId, kind, granted, source, createdAt: nowIso() };
    sdb().consents.push(rec);
    return clone(rec);
  },

  async getOpenDeletionRequest(profileId) {
    const r = sdb().deletions.find((x) => x.profileId === profileId && x.status === "pending");
    return r ? clone(r) : null;
  },
  async listMyDeletionRequests(profileId) {
    return clone(sdb().deletions.filter((x) => x.profileId === profileId).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1)));
  },
  async requestAccountDeletion(profileId, reason) {
    const open = await this.getOpenDeletionRequest(profileId);
    if (open) return open;
    const at = nowMs();
    const r = {
      id: randomUUID(),
      profileId,
      reason,
      status: "pending" as const,
      requestedAt: new Date(at).toISOString(),
      scheduledFor: new Date(at + GRACE_DAYS * 86400000).toISOString(),
      processedAt: null,
      processedBy: null,
      adminNote: null,
    };
    sdb().deletions.push(r);
    core().auditLog.push({
      id: randomUUID(),
      actorId: profileId,
      action: "account.delete_request",
      targetType: "profile",
      targetId: profileId,
      summary: "Demande de suppression de compte",
      details: { scheduledFor: r.scheduledFor },
      createdAt: nowIso(),
    });
    return clone(r);
  },
  async cancelAccountDeletion(profileId) {
    const r = sdb().deletions.find((x) => x.profileId === profileId && x.status === "pending");
    if (!r) return false;
    r.status = "cancelled";
    r.processedAt = nowIso();
    core().auditLog.push({
      id: randomUUID(),
      actorId: profileId,
      action: "account.delete_cancel",
      targetType: "profile",
      targetId: profileId,
      summary: "Demande de suppression annulée",
      details: {},
      createdAt: nowIso(),
    });
    return true;
  },
  async listDeletionRequests() {
    return clone([...sdb().deletions].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1)));
  },
  async anonymizeAccount(profileId, requestId, actorId) {
    const d = core();
    const p = d.profiles.find((x) => x.id === profileId);
    if (!p) throw new Error("Fiche introuvable.");
    if (p.roles.includes("admin")) throw new Error("Un compte administratrice ne s’anonymise pas : retirez d’abord le rôle.");
    if (profileId === actorId) throw new Error("On ne s’anonymise pas soi-même.");
    Object.assign(p, {
      firstName: "Ancienne",
      lastName: "membre",
      whatsapp: null,
      email: null,
      job: null,
      country: null,
      bio: null,
      avatarUrl: null,
      marrakechSince: null,
      plan: "free",
      planEndsAt: null,
      roles: [],
    });
    d.messages.forEach((m) => {
      if (m.authorId === profileId) m.body = "Message retiré (compte supprimé).";
    });
    d.notifications = d.notifications.filter((n) => n.recipientId !== profileId);
    d.notificationPrefs = d.notificationPrefs.filter((n) => n.profileId !== profileId);
    d.reminders = d.reminders.filter((r) => r.profileId !== profileId);
    d.organizationMembers = d.organizationMembers.filter((m) => m.profileId !== profileId);
    d.memberships.forEach((m) => {
      if (m.profileId === profileId && m.status === "active") m.status = "cancelled";
    });
    const s = sdb();
    s.consents = s.consents.filter((c) => c.profileId !== profileId);
    s.push = s.push.filter((c) => c.profileId !== profileId);
    s.deletions.forEach((r) => {
      if (r.profileId === profileId && r.status === "pending" && (!requestId || r.id === requestId)) {
        r.status = "done";
        r.processedAt = nowIso();
        r.processedBy = actorId;
      }
    });
  },
  async rejectDeletionRequest(requestId, actorId, note) {
    const r = sdb().deletions.find((x) => x.id === requestId && x.status === "pending");
    if (!r) return null;
    Object.assign(r, { status: "rejected", processedAt: nowIso(), processedBy: actorId, adminNote: note });
    return clone(r);
  },

  async personalDataExtras(profileId) {
    const d = core();
    return clone({
      memberships: d.memberships.filter((m) => m.profileId === profileId) as unknown as Array<Record<string, unknown>>,
      authoredMessages: d.messages.filter((m) => m.authorId === profileId).map((m) => ({ id: m.id, channel: m.channel, body: m.body, createdAt: m.createdAt })),
      auditAboutMe: d.auditLog.filter((e) => e.actorId === profileId || e.targetId === profileId),
      pushSubscriptions: sdb().push.filter((p) => p.profileId === profileId).length,
    });
  },

  async savePushSubscription(profileId, sub) {
    const s = sdb();
    s.push = s.push.filter((p) => p.endpoint !== sub.endpoint);
    s.push.push({ ...sub, id: randomUUID(), profileId, createdAt: nowIso() });
  },
  async deletePushSubscription(profileId, endpoint) {
    const s = sdb();
    s.push = s.push.filter((p) => !(p.profileId === profileId && p.endpoint === endpoint));
  },
  async countPushSubscriptions(profileId) {
    return sdb().push.filter((p) => p.profileId === profileId).length;
  },
  async listPushSubscriptionsFor(profileIds) {
    return clone(sdb().push.filter((p) => profileIds.includes(p.profileId)));
  },
  async removePushSubscriptionById(id) {
    const s = sdb();
    s.push = s.push.filter((p) => p.id !== id);
  },

  async searchAudit(filters) {
    const all: AuditEntry[] = [...core().auditLog].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return clone(all.filter((e) => auditMatches(e, filters)).slice(0, filters.limit ?? 200));
  },
  async getAuditEntry(id) {
    const e = core().auditLog.find((x) => x.id === id);
    return e ? clone(e) : null;
  },

  async listMySessions() {
    const at = nowMs();
    return [
      { id: "demo-s1", createdAt: new Date(at - 3 * 86400000).toISOString(), updatedAt: new Date(at - 60000).toISOString(), userAgent: "Safari · iPhone", ip: "196.200.x.x", aal: "aal1" },
      { id: "demo-s2", createdAt: new Date(at - 20 * 86400000).toISOString(), updatedAt: new Date(at - 2 * 86400000).toISOString(), userAgent: "Chrome · Mac", ip: "105.66.x.x", aal: "aal1" },
    ];
  },
  async getSecuritySettings() {
    return { ...sdb().settings };
  },
  async setSecuritySettings(s) {
    sdb().settings = { ...s };
  },
};
