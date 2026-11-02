/**
 * Vague 2 — Inscription et lancement : types du module (migration 0012_lancement.sql).
 */

/** Adhésion sur validation (candidature examinée par les fondatrices) ou directe (paiement immédiat). */
export type MembershipMode = "validation" | "direct";

export type LancementSettings = { membershipMode: MembershipMode; termsVersion: string; updatedAt: string | null };

/** Comment elle a connu le club (mêmes valeurs que la source des fiches CRM). */
export const HEARD_FROM = ["instagram", "bouche_a_oreille", "evenement", "site", "parrainage", "partenaire", "presse", "linkedin", "autre"] as const;
export type HeardFrom = (typeof HEARD_FROM)[number];
export const HEARD_FROM_LABEL: Record<HeardFrom, string> = {
  instagram: "Instagram",
  bouche_a_oreille: "Bouche-à-oreille",
  evenement: "Un rendez-vous du club",
  site: "Le site",
  parrainage: "Une membre m’a parrainée",
  partenaire: "Un partenaire du club",
  presse: "La presse",
  linkedin: "LinkedIn",
  autre: "Autre",
};

export type SignupPath = "free" | "apply";

export const ONBOARDING_STEPS = ["profile", "privacy", "notifications", "install"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const ONBOARDING_STEP_LABEL: Record<OnboardingStep, string> = {
  profile: "Ma fiche",
  privacy: "Confidentialité",
  notifications: "Notifications",
  install: "L’appli",
};

export type Onboarding = {
  profileId: string;
  heardFrom: HeardFrom | null;
  heardFromDetail: string | null;
  signupPath: SignupPath;
  referralCode: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  stepsDone: OnboardingStep[];
  completedAt: string | null;
  skippedAt: string | null;
  createdAt: string;
};

export type ApplicationStatus = "pending" | "accepted" | "refused" | "withdrawn";
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  withdrawn: "Retirée",
};

export type MembershipApplication = {
  id: string;
  profileId: string;
  job: string;
  company: string | null;
  marrakechSince: string;
  motivation: string;
  status: ApplicationStatus;
  decisionMessage: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

/** Candidature vue par les fondatrices (avec la personne). */
export type ApplicationView = MembershipApplication & {
  name: string;
  email: string | null;
  whatsapp: string | null;
  country: string | null;
  heardFrom: HeardFrom | null;
  decidedByName: string | null;
};

export type ApplicationInput = { job: string; company: string | null; marrakechSince: string; motivation: string };

/** Rôles attribuables par lien d'invitation. */
export const INVITABLE_ROLES = ["moderator", "partner", "pro"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export type InvitationState = "open" | "used" | "revoked" | "expired";

export type RoleInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  organizationId: string | null;
  note: string | null;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
  state: InvitationState;
};

export type InvitationPreview = { role: InvitableRole; emailHint: string; organization: string | null; state: InvitationState };

export type InvitationInput = { email: string; role: InvitableRole; organizationId: string | null; note: string | null };

/** Actions journalisées par le module (audit_log.action). */
export type LancementAuditAction =
  | "application.submit"
  | "application.accept"
  | "application.refuse"
  | "invitation.create"
  | "invitation.revoke"
  | "invitation.accept"
  | "settings.membership_mode";

export type LancementAuditTarget = "application" | "invitation" | "settings";

/** Types de notifications du module. */
export type LancementNotificationType = "application_received" | "application_accepted" | "application_refused";
