"use server";

/**
 * Lot 6 — server actions : consentements, suppression de compte, sessions, notifications push,
 * file de suppression (administratrices), réglages de sécurité, double authentification (mode réel).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { checkCapability, getViewer } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dayMonthShort, fullName } from "@/lib/format";
import { CONSENT_LABEL, isConsentKind } from "@/lib/modules/securite/consents";
import { rateLimitMessage } from "@/lib/modules/securite/rate-limit";
import { safeRedirectPath } from "@/lib/modules/securite/request";
import type { DeletionRequest } from "@/lib/modules/securite/types";

export type SecResult = { ok: true; message: string } | { ok: false; error: string };

async function me() {
  const v = await getViewer();
  return v.profile ? { ...v, profile: v.profile } : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------- consentements ---------- */

export async function setConsentAction(kind: string, granted: boolean): Promise<SecResult> {
  const v = await me();
  if (!v) return { ok: false, error: "Connecte-toi d’abord." };
  if (!isConsentKind(kind) || typeof granted !== "boolean") return { ok: false, error: "Choix inconnu." };
  const limited = await rateLimitMessage("account", `user:${v.profile.id}`);
  if (limited) return { ok: false, error: limited };
  await getRepo().recordConsent(v.profile.id, kind, granted, "app");
  const label = CONSENT_LABEL[kind].label;
  await audit({
    actorId: v.profile.id,
    action: "consent.update",
    targetType: "profile",
    targetId: v.profile.id,
    summary: `${fullName(v.profile)} : « ${label} » ${granted ? "accepté" : "retiré"}`,
    details: { kind, granted },
  });
  refresh();
  return { ok: true, message: `${label} : ${granted ? "accepté" : "retiré"}. C’est enregistré.` };
}

/* ---------- suppression de compte ---------- */

const reasonSchema = z.string().trim().max(500, "500 caractères au plus.").optional();

export type DeletionResult = { ok: true; message: string; request: DeletionRequest | null } | { ok: false; error: string };

export async function requestDeletionAction(reason?: string): Promise<DeletionResult> {
  const v = await me();
  if (!v) return { ok: false, error: "Connecte-toi d’abord." };
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const limited = await rateLimitMessage("account", `user:${v.profile.id}`);
  if (limited) return { ok: false, error: limited };
  if (v.roles.includes("admin") || v.profile.roles.includes("admin"))
    return { ok: false, error: "Un compte administratrice ne se supprime pas ainsi : demande d’abord à l’autre fondatrice de te retirer le rôle." };
  const r = await getRepo().requestAccountDeletion(v.profile.id, parsed.data || null);
  refresh();
  return { ok: true, message: `Demande enregistrée. Ton compte sera supprimé à partir du ${dayMonthShort(r.scheduledFor)}, sauf si tu changes d’avis d’ici là.`, request: r };
}

export async function cancelDeletionAction(): Promise<DeletionResult> {
  const v = await me();
  if (!v) return { ok: false, error: "Connecte-toi d’abord." };
  const done = await getRepo().cancelAccountDeletion(v.profile.id);
  refresh();
  return done ? { ok: true, message: "C’est annulé : ton compte reste ouvert.", request: null } : { ok: false, error: "Aucune demande en cours." };
}

/* ---------- sessions ---------- */

/** Déconnecte tous les appareils (mode réel : révoque toutes les sessions Supabase). */
export async function signOutEverywhereAction(): Promise<SecResult> {
  const v = await me();
  if (!v) return { ok: false, error: "Connecte-toi d’abord." };
  await audit({ actorId: v.profile.id, action: "auth.signout_all", targetType: "profile", targetId: v.profile.id, summary: `${fullName(v.profile)} s’est déconnectée de tous ses appareils` });
  if (v.mode === "demo") return { ok: true, message: "Simulé en démo : en mode réel, tous tes appareils sont déconnectés." };
  const { supabaseServer } = await import("@/lib/supabase/server");
  await (await supabaseServer()).auth.signOut({ scope: "global" });
  redirect("/connexion?deconnexion=partout");
}

/* ---------- notifications push ---------- */

const b64url = z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(200);
const pushSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: b64url, auth: b64url }),
  userAgent: z.string().max(300).nullable().optional(),
});

export async function savePushSubscriptionAction(input: unknown): Promise<SecResult> {
  const v = await me();
  if (!v) return { ok: false, error: "Connecte-toi d’abord." };
  const parsed = pushSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Abonnement invalide." };
  const limited = await rateLimitMessage("account", `user:${v.profile.id}`);
  if (limited) return { ok: false, error: limited };
  const { endpoint, keys, userAgent } = parsed.data;
  await getRepo().savePushSubscription(v.profile.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent ?? null });
  await audit({ actorId: v.profile.id, action: "push.subscribe", targetType: "profile", targetId: v.profile.id, summary: `${fullName(v.profile)} active les notifications sur un appareil` });
  refresh();
  return { ok: true, message: "Notifications activées sur cet appareil." };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<SecResult> {
  const v = await me();
  if (!v || typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, error: "Connecte-toi d’abord." };
  await getRepo().deletePushSubscription(v.profile.id, endpoint);
  refresh();
  return { ok: true, message: "Notifications coupées sur cet appareil." };
}

/** Envoie une notification d'essai à soi-même (mode réel avec clés VAPID). */
export async function testPushAction(): Promise<SecResult> {
  const v = await me();
  if (!v) return { ok: false, error: "Connecte-toi d’abord." };
  const { pushConfigured, sendPush } = await import("@/lib/modules/securite/push");
  if (!pushConfigured() || v.mode === "demo") return { ok: false, error: "Envoi désactivé : clés VAPID absentes (ou mode démo)." };
  const limited = await rateLimitMessage("account", `user:${v.profile.id}`);
  if (limited) return { ok: false, error: limited };
  const subs = await getRepo().listPushSubscriptionsFor([v.profile.id]);
  if (!subs.length) return { ok: false, error: "Aucun appareil abonné (ou clé service absente)." };
  const codes = await Promise.all(subs.map((s) => sendPush(s, { title: "Nomad Club", body: "Les notifications fonctionnent sur cet appareil.", link: "/espace" })));
  return codes.some((c) => c >= 200 && c < 300) ? { ok: true, message: "Notification d’essai envoyée." } : { ok: false, error: "Le service de notifications a refusé l’envoi." };
}

/* ---------- file de suppression (administratrices) ---------- */

const idSchema = z.string().min(1).max(64);

export async function anonymizeAction(requestId: string, early = false): Promise<SecResult> {
  const a = await checkCapability("privacy.process_deletions");
  if (!a) return { ok: false, error: "Réservé aux administratrices." };
  if (!idSchema.safeParse(requestId).success) return { ok: false, error: "Demande introuvable." };
  const repo = getRepo();
  const req = (await repo.listDeletionRequests()).find((r) => r.id === requestId);
  if (!req || req.status !== "pending") return { ok: false, error: "Cette demande est déjà traitée." };
  if (!early && Date.parse(req.scheduledFor) > nowMs()) {
    return { ok: false, error: `Délai de grâce jusqu’au ${dayMonthShort(req.scheduledFor)}. Confirmez pour traiter plus tôt.` };
  }
  const target = await repo.getProfile(req.profileId);
  const name = target ? fullName(target) : "Compte";
  try {
    await repo.anonymizeAccount(req.profileId, req.id, a.profile.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Anonymisation impossible." };
  }
  await audit({
    actorId: a.profile.id,
    action: "account.anonymize",
    targetType: "profile",
    targetId: req.profileId,
    summary: `Compte de ${name} anonymisé (demande du ${dayMonthShort(req.requestedAt)})`,
    details: { requestId: req.id, early, kept: ["payments", "bookings", "audit_log"] },
  });
  refresh();
  return { ok: true, message: `Compte de ${name} anonymisé. Les paiements sont conservés.` };
}

const noteSchema = z.string().trim().min(3, "Expliquez en quelques mots.").max(500);

export async function rejectDeletionAction(requestId: string, note: string): Promise<SecResult> {
  const a = await checkCapability("privacy.process_deletions");
  if (!a) return { ok: false, error: "Réservé aux administratrices." };
  const n = noteSchema.safeParse(note);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  if (!idSchema.safeParse(requestId).success) return { ok: false, error: "Demande introuvable." };
  const r = await getRepo().rejectDeletionRequest(requestId, a.profile.id, n.data);
  if (!r) return { ok: false, error: "Cette demande est déjà traitée." };
  await audit({ actorId: a.profile.id, action: "account.delete_reject", targetType: "profile", targetId: r.profileId, summary: "Demande de suppression refusée", details: { requestId, note: n.data } });
  refresh();
  return { ok: true, message: "Demande refusée, la membre garde son compte." };
}

/* ---------- réglages de sécurité ---------- */

export async function setMfaEnforcedAction(enforced: boolean): Promise<SecResult> {
  const a = await checkCapability("security.manage");
  if (!a) return { ok: false, error: "Réservé aux administratrices." };
  await getRepo().setSecuritySettings({ adminMfaEnforced: Boolean(enforced) }, a.profile.id);
  await audit({
    actorId: a.profile.id,
    action: "security.settings",
    targetType: "profile",
    targetId: a.profile.id,
    summary: enforced ? "La base exige la double authentification des administratrices" : "Double authentification non exigée par la base",
    details: { adminMfaEnforced: Boolean(enforced) },
  });
  refresh();
  return { ok: true, message: enforced ? "Double authentification exigée par la base." : "Exigence retirée côté base." };
}

/* ---------- double authentification (mode réel, Supabase MFA) ---------- */

export type EnrollResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };

/** Une administratrice connectée (rôles réels, même en AAL1). */
async function adminSession() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("profile_id", user.id);
  if (!(data ?? []).some((r) => r.role === "admin")) return null;
  return { supabase, user };
}

export async function startMfaEnrollAction(): Promise<EnrollResult> {
  if ((await getViewer()).mode === "demo") return { ok: false, error: "Simulé en démo." };
  const s = await adminSession();
  if (!s) return { ok: false, error: "Réservé aux administratrices connectées." };
  const { qrToDataUrl } = await import("@/lib/modules/securite/mfa");
  // les facteurs non vérifiés d'une tentative précédente bloqueraient l'enrôlement
  const factors = await s.supabase.auth.mfa.listFactors();
  for (const f of factors.data?.all ?? []) if (f.status !== "verified") await s.supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await s.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Nomad Club ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { ok: false, error: "Enrôlement impossible. La double authentification est-elle activée dans Supabase (Auth › MFA) ?" };
  return { ok: true, factorId: data.id, qr: qrToDataUrl(data.totp.qr_code), secret: data.totp.secret };
}

const codeSchema = z.string().regex(/^\d{6}$/, "Le code à 6 chiffres de ton application.");

export async function verifyMfaAction(factorId: string | null, code: string, suite?: string): Promise<SecResult> {
  const c = codeSchema.safeParse(String(code ?? "").replace(/\s/g, ""));
  if (!c.success) return { ok: false, error: c.error.issues[0].message };
  if ((await getViewer()).mode === "demo") return { ok: false, error: "Simulé en démo." };
  const s = await adminSession();
  if (!s) return { ok: false, error: "Réservé aux administratrices connectées." };
  const limited = await rateLimitMessage("mfa", `user:${s.user.id}`);
  if (limited) return { ok: false, error: limited };
  let id = factorId;
  const enrolling = Boolean(factorId);
  if (!id) id = (await s.supabase.auth.mfa.listFactors()).data?.totp[0]?.id ?? null;
  if (!id || typeof id !== "string" || id.length > 64) return { ok: false, error: "Aucun facteur : commence par l’enrôlement." };
  const { error } = await s.supabase.auth.mfa.challengeAndVerify({ factorId: id, code: c.data });
  if (error) return { ok: false, error: "Code refusé. Vérifie l’heure de ton téléphone et réessaie." };
  await audit({
    actorId: s.user.id,
    action: enrolling ? "auth.mfa_enroll" : "auth.mfa_verify",
    targetType: "profile",
    targetId: s.user.id,
    summary: enrolling ? "Double authentification activée" : "Double authentification vérifiée",
  });
  redirect(safeRedirectPath(suite, "/fondatrices"));
}
