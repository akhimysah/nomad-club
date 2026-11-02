/**
 * Vague 2 — Inscription et lancement : implémentation démo (mémoire du processus).
 * Mêmes règles que les fonctions SQL de 0012_lancement.sql : une candidature en attente par personne,
 * décision réservée aux admins (vérifiée par l'action), notifications et journal écrits ici comme en base.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { nowIso } from "../../clock";
import { fullName } from "../../format";
import type { LancementRepo } from "./repo";
import type { ApplicationView, InvitationState, LancementSettings, MembershipApplication, Onboarding, RoleInvitation } from "./types";

type Store = {
  settings: LancementSettings;
  onboarding: Map<string, Onboarding>;
  applications: MembershipApplication[];
  invitations: Array<Omit<RoleInvitation, "state"> & { tokenHash: string }>;
};
type G = typeof globalThis & { __nomadLancement?: Store };

const TERMS_VERSION = "2026-11-brouillon";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const daysAgo = (n: number) => new Date(Date.now() - n * 86400e3).toISOString();

function store(): Store {
  const g = globalThis as G;
  if (!g.__nomadLancement) {
    g.__nomadLancement = {
      settings: { membershipMode: "validation", termsVersion: TERMS_VERSION, updatedAt: null },
      onboarding: new Map(),
      // deux candidatures d'exemple (comptes gratuits de la démo)
      applications: [
        { id: "app-hana", profileId: "p-hana", job: "Ingénieure en énergie solaire", company: "SunAtlas", marrakechSince: "2026", motivation: "Je viens d’arriver à Marrakech et je cherche un cercle d’entrepreneuses pour échanger et monter des projets.", status: "pending", decisionMessage: null, decidedBy: null, decidedAt: null, createdAt: daysAgo(2) },
        { id: "app-clara", profileId: "p-clara", job: "Graphiste et créatrice de bijoux", company: null, marrakechSince: "2023", motivation: "Une amie membre m’a parlé des lunchs : j’aimerais rencontrer d’autres créatrices et partager mon réseau d’artisans.", status: "pending", decisionMessage: null, decidedBy: null, decidedAt: null, createdAt: daysAgo(5) },
      ],
      invitations: [],
    };
  }
  return g.__nomadLancement;
}

async function demo() {
  return (await import("../../data/demo-repo")).demoRepo;
}

function stateOf(i: { acceptedAt: string | null; revokedAt: string | null; expiresAt: string }): InvitationState {
  if (i.acceptedAt) return "used";
  if (i.revokedAt) return "revoked";
  if (i.expiresAt < nowIso()) return "expired";
  return "open";
}

function onboardingOf(profileId: string): Onboarding {
  const s = store();
  let o = s.onboarding.get(profileId);
  if (!o) {
    // comptes de la démo : déjà utilisés, l'onboarding est considéré comme fait (reprise possible depuis « Moi »)
    o = { profileId, heardFrom: null, heardFromDetail: null, signupPath: "free", referralCode: null, termsVersion: TERMS_VERSION, termsAcceptedAt: nowIso(), stepsDone: [], completedAt: nowIso(), skippedAt: null, createdAt: nowIso() };
    s.onboarding.set(profileId, o);
  }
  return o;
}

export const lancementDemoRepo: LancementRepo = {
  async getLancementSettings() {
    return { ...store().settings };
  },
  async setMembershipMode(mode) {
    const s = store();
    s.settings = { ...s.settings, membershipMode: mode, updatedAt: nowIso() };
    return { ...s.settings };
  },

  async getOnboarding(profileId) {
    return structuredClone(onboardingOf(profileId));
  },
  async acceptTerms(profileId) {
    const o = onboardingOf(profileId);
    o.termsVersion = store().settings.termsVersion;
    o.termsAcceptedAt = nowIso();
    return structuredClone(o);
  },
  async onboardingProgress(profileId, step, finish) {
    const o = onboardingOf(profileId);
    if (step && !o.stepsDone.includes(step)) o.stepsDone = [...o.stepsDone, step];
    if (finish === "completed") o.completedAt = nowIso();
    if (finish === "skipped") o.skippedAt = nowIso();
    if (finish === "reset") {
      o.completedAt = null;
      o.skippedAt = null;
    }
    return structuredClone(o);
  },

  async submitApplication(profileId, input) {
    const s = store();
    const repo = await demo();
    const p = await repo.getProfile(profileId);
    if (!p) throw new Error("Connecte-toi d’abord.");
    if (p.plan !== "free") throw new Error("Tu es déjà membre du club.");
    if (s.applications.some((a) => a.profileId === profileId && a.status === "pending")) throw new Error("Ta candidature est déjà en cours d’examen.");
    const a: MembershipApplication = { id: randomUUID(), profileId, ...input, status: "pending", decisionMessage: null, decidedBy: null, decidedAt: null, createdAt: nowIso() };
    s.applications.push(a);
    const admins = (await repo.listProfiles()).filter((x) => x.roles.includes("admin"));
    await repo.createNotifications(admins.map((x) => ({ recipientId: x.id, type: "application_received", title: "Nouvelle candidature", body: `${fullName(p)} · ${a.job}`, link: "/fondatrices/candidatures" })));
    await repo.logAudit({ actorId: profileId, action: "application.submit", targetType: "application", targetId: a.id, summary: `Candidature de ${fullName(p)}`, details: { job: a.job } });
    return structuredClone(a);
  },
  async withdrawApplication(profileId) {
    const a = store().applications.find((x) => x.profileId === profileId && x.status === "pending");
    if (!a) return false;
    a.status = "withdrawn";
    return true;
  },
  async listMyApplications(profileId) {
    return structuredClone(store().applications.filter((a) => a.profileId === profileId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  },
  async listApplications() {
    const repo = await demo();
    const profiles = new Map((await repo.listProfiles()).map((p) => [p.id, p]));
    return store()
      .applications.map((a): ApplicationView => {
        const p = profiles.get(a.profileId);
        const by = a.decidedBy ? profiles.get(a.decidedBy) : null;
        return { ...a, name: p ? fullName(p) : "Compte supprimé", email: p?.email ?? null, whatsapp: p?.whatsapp ?? null, country: p?.country ?? null, heardFrom: store().onboarding.get(a.profileId)?.heardFrom ?? null, decidedByName: by ? by.firstName : null };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async decideApplication(id, accept, message, actorId) {
    const a = store().applications.find((x) => x.id === id);
    if (!a || a.status !== "pending") throw new Error("Cette candidature a déjà reçu une réponse.");
    if (!accept && !message) throw new Error("Un message est nécessaire pour un refus.");
    a.status = accept ? "accepted" : "refused";
    a.decisionMessage = message;
    a.decidedBy = actorId;
    a.decidedAt = nowIso();
    const repo = await demo();
    const p = await repo.getProfile(a.profileId);
    await repo.createNotifications([
      {
        recipientId: a.profileId,
        type: accept ? "application_accepted" : "application_refused",
        title: accept ? "Ta candidature est acceptée" : "Réponse à ta candidature",
        body: accept ? `Bienvenue au Nomad Club ! Choisis ta formule pour activer ton adhésion.${message ? ` ${message}` : ""}` : (message ?? ""),
        link: accept ? "/formules" : "/candidature",
      },
    ]);
    await repo.logAudit({ actorId, action: accept ? "application.accept" : "application.refuse", targetType: "application", targetId: a.id, summary: `${accept ? "Candidature acceptée" : "Candidature refusée"} · ${p ? fullName(p) : ""}`, details: { profileId: a.profileId, message } });
    return structuredClone(a);
  },
  async canJoinMembership(profileId) {
    const s = store();
    if (s.settings.membershipMode === "direct") return true;
    const p = await (await demo()).getProfile(profileId);
    if (!p) return false;
    return p.roles.includes("admin") || p.plan !== "free" || !!p.planEndsAt || s.applications.some((a) => a.profileId === profileId && a.status === "accepted");
  },

  async createRoleInvitation(input, actorId) {
    const s = store();
    const now = nowIso();
    s.invitations.forEach((i) => {
      if (i.email === input.email && i.role === input.role && !i.acceptedAt && !i.revokedAt) i.revokedAt = now;
    });
    const token = randomBytes(24).toString("hex");
    const inv = { id: randomUUID(), ...input, invitedBy: actorId, createdAt: now, expiresAt: new Date(Date.now() + 14 * 86400e3).toISOString(), acceptedAt: null, acceptedBy: null, revokedAt: null, tokenHash: hash(token) };
    s.invitations.push(inv);
    await (await demo()).logAudit({ actorId, action: "invitation.create", targetType: "invitation", targetId: inv.id, summary: `Invitation ${input.role} · ${input.email}`, details: { role: input.role, email: input.email } });
    return { id: inv.id, token, expiresAt: inv.expiresAt };
  },
  async listRoleInvitations() {
    return store()
      .invitations.map(({ tokenHash, ...i }) => {
        void tokenHash;
        return { ...i, state: stateOf(i) };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async revokeRoleInvitation(id, actorId) {
    const i = store().invitations.find((x) => x.id === id);
    if (!i || i.acceptedAt || i.revokedAt) return false;
    i.revokedAt = nowIso();
    await (await demo()).logAudit({ actorId, action: "invitation.revoke", targetType: "invitation", targetId: id, summary: "Invitation révoquée" });
    return true;
  },
  async previewRoleInvitation(token) {
    const i = store().invitations.find((x) => x.tokenHash === hash(token));
    if (!i) return null;
    const repo = await demo();
    const org = i.organizationId ? (await repo.listOrganizations()).find((o) => o.id === i.organizationId) : null;
    return { role: i.role, emailHint: `${i.email.slice(0, 2)}•••@${i.email.split("@")[1]}`, organization: org?.name ?? null, state: stateOf(i) };
  },
  async acceptRoleInvitation(token, profileId) {
    const i = store().invitations.find((x) => x.tokenHash === hash(token));
    if (!i) throw new Error("invitation_not_found");
    const st = stateOf(i);
    if (st !== "open") throw new Error(`invitation_${st}`);
    const repo = await demo();
    const p = await repo.getProfile(profileId);
    // en démo, le personnage incarné accepte l'invitation quelle que soit l'adresse
    if (!p) throw new Error("login");
    await repo.grantRole(profileId, i.role, i.invitedBy ?? profileId);
    i.acceptedAt = nowIso();
    i.acceptedBy = profileId;
    await repo.logAudit({ actorId: profileId, action: "invitation.accept", targetType: "invitation", targetId: i.id, summary: `Invitation acceptée · ${i.role} · ${i.email}`, details: { role: i.role } });
    return { role: i.role, organizationId: i.organizationId };
  },
};
