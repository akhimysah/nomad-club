/**
 * Vague 2 — Inscription et lancement : règles pures (validation, messages, parcours).
 * Importable partout (pas d'accès aux données).
 */
import { z } from "zod";
import { firstNameSchema, whatsappSchema } from "../../validation";
import { HEARD_FROM, INVITABLE_ROLES, ONBOARDING_STEPS, type Onboarding, type OnboardingStep } from "./types";

const optional = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((s) => (s === "" ? null : s))
    .nullable();

/** Formulaire d'inscription (création du compte par lien magique). */
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Une adresse e-mail valide, s’il te plaît.").email("Une adresse e-mail valide, s’il te plaît."),
  firstName: firstNameSchema,
  lastName: z.string().trim().min(1, "Ton nom, s’il te plaît.").max(60, "Un nom un peu plus court."),
  whatsapp: whatsappSchema,
  country: z.string().trim().min(2, "Ton pays (ou ta nationalité).").max(60, "Un pays un peu plus court."),
  heardFrom: z.enum(HEARD_FROM, { errorMap: () => ({ message: "Dis-nous comment tu as connu le club." }) }),
  heardFromDetail: optional(200, "Précision trop longue (200 caractères)."),
  referralCode: optional(24, "Code de parrainage trop long.").transform((s) => (s ? s.toUpperCase().replace(/[^A-Z0-9-]/g, "") || null : null)),
  path: z.enum(["free", "apply"]),
  terms: z.literal(true, { errorMap: () => ({ message: "Accepte les conditions d’utilisation et la politique de confidentialité pour continuer." }) }),
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Candidature d'adhésion. */
export const applicationSchema = z.object({
  job: z.string().trim().min(2, "Ton métier, s’il te plaît.").max(120, "Un métier un peu plus court."),
  company: optional(120, "Nom d’entreprise trop long."),
  marrakechSince: z.string().trim().min(1, "Depuis quand es-tu à Marrakech ?").max(40, "Réponse trop longue (40 caractères)."),
  motivation: z.string().trim().min(20, "Quelques phrases sur tes motivations (20 caractères au moins).").max(2000, "2 000 caractères au plus."),
});

/** Invitation par e-mail qui attribue un rôle. */
export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Une adresse e-mail valide, s’il te plaît."),
  role: z.enum(INVITABLE_ROLES),
  organizationId: z.string().uuid().nullable().or(z.literal("").transform(() => null)),
  note: optional(300, "Note trop longue (300 caractères)."),
});

/** Profil de base (onboarding d'un compte gratuit). */
export const basicProfileSchema = z.object({
  firstName: firstNameSchema,
  lastName: z.string().trim().max(60),
  job: optional(120, "Un métier un peu plus court."),
  country: optional(60, "Un pays un peu plus court."),
  whatsapp: z.union([whatsappSchema, z.literal("").transform(() => null)]).nullable(),
  avatarUrl: z
    .string()
    .max(1_400_000, "Photo trop lourde.")
    .refine((s) => /^data:image\/(jpeg|png|webp);base64,/.test(s) || /^https:\/\//.test(s), "Photo invalide.")
    .nullable(),
});

/** Erreurs SQL / démo → phrases lisibles. */
export function friendly(m: string): string {
  if (m.includes("already_member")) return "Tu es déjà membre du club.";
  if (m.includes("already_pending")) return "Ta candidature est déjà en cours d’examen.";
  if (m.includes("message_required")) return "Un message est nécessaire pour un refus.";
  if (m.includes("not_pending")) return "Cette candidature a déjà reçu une réponse.";
  if (m.includes("admin_only")) return "Réservé aux fondatrices.";
  if (m.includes("invalid_role")) return "Rôle non proposé par invitation.";
  if (m.includes("organization_not_found")) return "Établissement introuvable.";
  if (m.includes("invitation_email_mismatch")) return "Cette invitation a été envoyée à une autre adresse e-mail : connecte-toi avec celle-ci.";
  if (m.includes("invitation_used")) return "Cette invitation a déjà servi.";
  if (m.includes("invitation_revoked")) return "Cette invitation a été annulée.";
  if (m.includes("invitation_expired")) return "Cette invitation a expiré : demande-en une nouvelle aux fondatrices.";
  if (m.includes("invitation_not_found")) return "Invitation introuvable.";
  if (m.includes("membership_applications_job_check") || m.includes("membership_applications_motivation_check")) return "Complète ta candidature (métier, motivations d’au moins 20 caractères).";
  if (m.includes("login")) return "Connecte-toi d’abord.";
  return m;
}

/** L'onboarding est-il encore à proposer à la première connexion ? */
export function onboardingPending(o: Pick<Onboarding, "completedAt" | "skippedAt">): boolean {
  return !o.completedAt && !o.skippedAt;
}

/** Étape suivante non faite (ou null si tout est fait). */
export function nextStep(o: Pick<Onboarding, "stepsDone">, after?: OnboardingStep): OnboardingStep | null {
  const start = after ? ONBOARDING_STEPS.indexOf(after) + 1 : 0;
  return ONBOARDING_STEPS.slice(start).find((s) => !o.stepsDone.includes(s)) ?? ONBOARDING_STEPS[start] ?? null;
}

export function parseStep(v: string | undefined | null): OnboardingStep | null {
  return (ONBOARDING_STEPS as readonly string[]).includes(v ?? "") ? (v as OnboardingStep) : null;
}

/** Où aller une fois l'onboarding fini ou sauté. */
export function afterOnboarding(o: Pick<Onboarding, "signupPath">, opts: { member: boolean; next: string | null }): string {
  if (opts.next && opts.next !== "/bienvenue") return opts.next;
  if (opts.member) return "/espace";
  return o.signupPath === "apply" ? "/candidature" : "/";
}
