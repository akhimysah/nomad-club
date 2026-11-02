"use server";

/**
 * Vague 2 — Inscription et lancement : inscription, onboarding, candidatures, réglage d'adhésion,
 * invitations à usage unique. Les écritures sensibles sont journalisées (en base pour le mode réel).
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { checkCapability, getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { isRealMode } from "@/lib/env";
import { fullName } from "@/lib/format";
import { afterOnboarding, applicationSchema, basicProfileSchema, friendly, invitationSchema, nextStep, parseStep, signupSchema } from "@/lib/modules/lancement/domain";
import { emailApplicationDecision, emailInvitation, invitationRoleLabel } from "@/lib/modules/lancement/server";
import type { MembershipMode, OnboardingStep } from "@/lib/modules/lancement/types";
import { REFERRAL_COOKIE } from "@/lib/modules/engagement/referral-cookie";
import { rateLimitMessage } from "@/lib/modules/securite/rate-limit";
import { clientIp, safeRedirectPath } from "@/lib/modules/securite/request";
import { inCircle } from "@/lib/permissions";
import { siteUrl } from "@/lib/site";

export type FormState = { ok: boolean; message: string; field?: string } | null;
export type LancementResult = { ok: true; message: string } | { ok: false; error: string };

const errMsg = (e: unknown) => friendly(e instanceof Error ? e.message : String(e));

/* ---------------- inscription ---------------- */

/** Crée le compte (mode réel) : lien magique avec la fiche d'inscription en métadonnées. */
export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    email: form.get("email") ?? "",
    firstName: form.get("firstName") ?? "",
    lastName: form.get("lastName") ?? "",
    whatsapp: form.get("whatsapp") ?? "",
    country: form.get("country") ?? "",
    heardFrom: form.get("heardFrom") ?? "",
    heardFromDetail: form.get("heardFromDetail") ?? "",
    referralCode: form.get("referralCode") ?? "",
    path: form.get("path") === "apply" ? "apply" : "free",
    terms: form.get("terms") === "on",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue.message, field: String(issue.path[0] ?? "") };
  }
  const d = parsed.data;
  if (!isRealMode()) {
    return { ok: true, message: `Aperçu : dans la vraie appli, ${d.firstName} reçoit ici un lien de connexion à ${d.email}. Choisis un espace en haut de l’écran pour visiter.` };
  }
  const limited = (await rateLimitMessage("magicLinkIp")) ?? (await rateLimitMessage("magicLinkEmail", `email:${d.email}`));
  if (limited) return { ok: false, message: limited };
  if (d.referralCode) (await cookies()).set(REFERRAL_COOKIE, d.referralCode, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  const invitation = String(form.get("invitation") ?? "");
  const suite = /^[0-9a-f]{48}$/.test(invitation) ? `/invitation/${invitation}` : `/bienvenue${d.path === "apply" ? "?parcours=adhesion" : ""}`;
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: d.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${await siteUrl()}/auth/callback?suite=${encodeURIComponent(suite)}`,
      // repris par le déclencheur handle_new_user (0012) à la création du compte ; ignorés si le compte existe déjà
      data: {
        first_name: d.firstName,
        last_name: d.lastName,
        whatsapp: d.whatsapp,
        country: d.country,
        heard_from: d.heardFrom,
        heard_from_detail: d.heardFromDetail,
        referral_code: d.referralCode,
        signup_path: d.path,
        terms_accepted: "true",
      },
    },
  });
  if (error) return { ok: false, message: "L’envoi n’a pas fonctionné. Réessaie dans une minute." };
  return { ok: true, message: `C’est parti, ${d.firstName} : ouvre le lien envoyé à ${d.email} (sur cet appareil de préférence) pour activer ton compte.` };
}

/* ---------------- onboarding ---------------- */

async function connected() {
  const v = await getViewer();
  if (!v.profile) redirect("/connexion?suite=/bienvenue");
  return { ...v, profile: v.profile };
}

function stepUrl(step: OnboardingStep | null, suite: string | null, fallback: string) {
  if (!step) return fallback;
  return `/bienvenue?etape=${step}${suite ? `&suite=${encodeURIComponent(suite)}` : ""}`;
}

/** CGU et politique de confidentialité (comptes créés sans passer par le formulaire d'inscription). */
export async function acceptTermsAction(form: FormData): Promise<void> {
  const v = await connected();
  if (form.get("terms") !== "on") redirect(`/bienvenue?cgu=1${form.get("suite") ? `&suite=${encodeURIComponent(String(form.get("suite")))}` : ""}`);
  await getRepo().acceptTerms(v.profile.id, await clientIp());
  const suite = form.get("suite") ? safeRedirectPath(String(form.get("suite")), "/") : null;
  redirect(stepUrl("profile", suite, "/"));
}

/** Étape suivante, étape passée, onboarding sauté ou terminé (formulaires sans JavaScript). */
export async function onboardingAction(form: FormData): Promise<void> {
  const v = await connected();
  const repo = getRepo();
  const step = parseStep(String(form.get("step") ?? ""));
  const intent = String(form.get("intent") ?? "next"); // next | skip-step | skip-all | finish
  const suite = form.get("suite") ? safeRedirectPath(String(form.get("suite")), "/") : null;
  let o = await repo.getOnboarding(v.profile.id);
  if (intent === "skip-all") {
    await repo.onboardingProgress(v.profile.id, null, "skipped");
    redirect(afterOnboarding(o, { member: inCircle(v.profile), next: suite }));
  }
  if (step && intent === "next") o = await repo.onboardingProgress(v.profile.id, step, null);
  const following = step ? nextStep({ stepsDone: [] }, step) : null;
  if (intent === "finish" || !following) {
    o = await repo.onboardingProgress(v.profile.id, step && intent === "next" ? step : null, "completed");
    revalidatePath("/", "layout");
    redirect(afterOnboarding(o, { member: inCircle(v.profile), next: suite }));
  }
  redirect(stepUrl(following, suite, "/"));
}

/** Reprendre l'onboarding plus tard (depuis « Moi »). */
export async function restartOnboardingAction(): Promise<void> {
  const v = await connected();
  await getRepo().onboardingProgress(v.profile.id, null, "reset");
  redirect("/bienvenue?etape=profile");
}

/** Fiche de base (compte gratuit) : prénom, nom, métier, pays, WhatsApp, photo. */
export async function saveBasicProfileAction(input: { firstName: string; lastName: string; job: string; country: string; whatsapp: string; avatarUrl: string | null }): Promise<LancementResult> {
  const v = await getViewer();
  if (!v.profile) return { ok: false, error: "Connecte-toi d’abord." };
  const parsed = basicProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const repo = getRepo();
  try {
    const d = await repo.getDirectoryProfile(v.profile.id);
    await repo.updateOwnProfile(v.profile.id, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      job: parsed.data.job,
      country: parsed.data.country,
      whatsapp: parsed.data.whatsapp,
      avatarUrl: parsed.data.avatarUrl,
      marrakechSince: v.profile.marrakechSince,
      bio: v.profile.bio,
      company: d?.company ?? null,
      sector: d?.sector ?? null,
      skills: d?.skills ?? [],
      instagram: d?.instagram ?? null,
      linkedin: d?.linkedin ?? null,
      website: d?.website ?? null,
      lookingFor: d?.lookingFor ?? null,
      offering: d?.offering ?? null,
      visibility: d?.visibility ?? "all",
      showWhatsapp: d?.showWhatsapp ?? false,
      showEmail: d?.showEmail ?? false,
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Ta fiche est enregistrée." };
}

/* ---------------- candidatures ---------------- */

export async function submitApplicationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const v = await getViewer();
  if (!v.profile) return { ok: false, message: v.mode === "demo" ? "En démo, choisis l’espace « Compte gratuit » puis connecte-toi… ou visite l’espace Fondatrices pour voir les candidatures." : "Connecte-toi d’abord." };
  const parsed = applicationSchema.safeParse({ job: form.get("job") ?? "", company: form.get("company") ?? "", marrakechSince: form.get("marrakechSince") ?? "", motivation: form.get("motivation") ?? "" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue.message, field: String(issue.path[0] ?? "") };
  }
  try {
    await getRepo().submitApplication(v.profile.id, parsed.data);
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
  revalidatePath("/candidature");
  revalidatePath("/fondatrices", "layout");
  return { ok: true, message: "Merci ! Ta candidature est envoyée. Julia et Nora te répondent par e-mail et dans l’appli." };
}

export async function withdrawApplicationAction(): Promise<void> {
  const v = await getViewer();
  if (v.profile) await getRepo().withdrawApplication(v.profile.id);
  revalidatePath("/candidature");
  redirect("/candidature");
}

export async function decideApplicationAction(id: string, accept: boolean, message: string): Promise<LancementResult> {
  const me = await checkCapability("members.manage");
  if (!me) return { ok: false, error: "Réservé aux fondatrices." };
  const msg = message.trim().slice(0, 1000) || null;
  if (!accept && !msg) return { ok: false, error: "Écris un message pour expliquer le refus (il est envoyé à la personne)." };
  const repo = getRepo();
  try {
    const app = await repo.decideApplication(id, accept, msg, me.profile.id);
    const p = await repo.getProfile(app.profileId);
    if (p) await emailApplicationDecision(p.email, p.firstName, app, await siteUrl());
    revalidatePath("/fondatrices", "layout");
    return { ok: true, message: accept ? `Candidature acceptée${p ? ` : ${fullName(p)} est invitée à choisir sa formule` : ""}.` : "Réponse envoyée." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setMembershipModeAction(mode: MembershipMode): Promise<LancementResult> {
  const me = await checkCapability("members.manage");
  if (!me) return { ok: false, error: "Réservé aux fondatrices." };
  if (mode !== "validation" && mode !== "direct") return { ok: false, error: "Réglage inconnu." };
  await getRepo().setMembershipMode(mode, me.profile.id);
  await audit({
    actorId: me.profile.id,
    action: "settings.membership_mode",
    targetType: "settings",
    targetId: null,
    summary: mode === "direct" ? "Adhésion directe (sans validation)" : "Adhésion sur validation des candidatures",
    details: { mode },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: mode === "direct" ? "Adhésion directe : chacune peut payer sans candidature." : "Adhésion sur validation : une candidature acceptée est demandée avant le paiement." };
}

/* ---------------- invitations ---------------- */

export type InvitationState = { ok: boolean; message: string; link?: string; emailed?: boolean } | null;

export async function createInvitationAction(_prev: InvitationState, form: FormData): Promise<InvitationState> {
  const me = await checkCapability("roles.manage");
  if (!me) return { ok: false, message: "Réservé aux administratrices." };
  const parsed = invitationSchema.safeParse({ email: form.get("email") ?? "", role: form.get("role") ?? "", organizationId: form.get("organizationId") ?? "", note: form.get("note") ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const repo = getRepo();
  try {
    const inv = await repo.createRoleInvitation(parsed.data, me.profile.id);
    const link = `${await siteUrl()}/invitation/${inv.token}`;
    const org = parsed.data.organizationId ? (await repo.listOrganizations()).find((o) => o.id === parsed.data.organizationId) : null;
    const emailed = await emailInvitation({ to: parsed.data.email, link, role: parsed.data.role, inviter: me.profile.firstName, expiresAt: inv.expiresAt, note: parsed.data.note, organization: org?.name ?? null });
    revalidatePath("/fondatrices/roles");
    return {
      ok: true,
      link,
      emailed,
      message: emailed
        ? `Invitation ${invitationRoleLabel(parsed.data.role)} envoyée à ${parsed.data.email}.`
        : `Invitation ${invitationRoleLabel(parsed.data.role)} créée. L’envoi d’e-mails n’est pas encore branché : copie le lien ci-dessous et envoie-le à ${parsed.data.email} (il ne sera plus affiché).`,
    };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function revokeInvitationAction(id: string): Promise<LancementResult> {
  const me = await checkCapability("roles.manage");
  if (!me) return { ok: false, error: "Réservé aux administratrices." };
  const done = await getRepo().revokeRoleInvitation(id, me.profile.id);
  revalidatePath("/fondatrices/roles");
  return done ? { ok: true, message: "Invitation annulée." } : { ok: false, error: "Invitation déjà utilisée ou annulée." };
}

const SPACE_OF_ROLE = { moderator: "/espace/moderation", partner: "/partenaire", pro: "/pro" } as const;

export async function acceptInvitationAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  if (!/^[0-9a-f]{48}$/.test(token)) redirect("/");
  const v = await getViewer();
  if (!v.profile) redirect(`/connexion?suite=${encodeURIComponent(`/invitation/${token}`)}`);
  let dest: string;
  try {
    const r = await getRepo().acceptRoleInvitation(token, v.profile.id);
    dest = SPACE_OF_ROLE[r.role];
    revalidatePath("/", "layout");
  } catch (e) {
    redirect(`/invitation/${token}?erreur=${encodeURIComponent(errMsg(e))}`);
  }
  redirect(dest);
}
