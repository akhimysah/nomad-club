/**
 * Vague 2 — Inscription et lancement : accès aux données (interface étendue par `Repo`).
 * Implémentations : `demo.ts` (mémoire) et `supabase.ts` (fonctions SQL de 0012_lancement.sql).
 */
import type {
  ApplicationInput,
  ApplicationView,
  InvitationInput,
  InvitationPreview,
  LancementSettings,
  MembershipApplication,
  MembershipMode,
  Onboarding,
  OnboardingStep,
  RoleInvitation,
} from "./types";

export interface LancementRepo {
  getLancementSettings(): Promise<LancementSettings>;
  setMembershipMode(mode: MembershipMode, actorId: string): Promise<LancementSettings>;

  /** État de l'inscription de la personne (ligne créée au besoin). */
  getOnboarding(profileId: string): Promise<Onboarding>;
  /** CGU + politique de confidentialité acceptées (version en vigueur). */
  acceptTerms(profileId: string, ip: string | null): Promise<Onboarding>;
  onboardingProgress(profileId: string, step: OnboardingStep | null, finish: "completed" | "skipped" | "reset" | null): Promise<Onboarding>;

  submitApplication(profileId: string, input: ApplicationInput): Promise<MembershipApplication>;
  withdrawApplication(profileId: string): Promise<boolean>;
  listMyApplications(profileId: string): Promise<MembershipApplication[]>;
  listApplications(): Promise<ApplicationView[]>;
  decideApplication(id: string, accept: boolean, message: string | null, actorId: string): Promise<MembershipApplication>;
  /** La personne peut-elle payer une première adhésion (mode direct, candidature acceptée, déjà membre) ? */
  canJoinMembership(profileId: string): Promise<boolean>;

  /** Crée une invitation ; le jeton n'est renvoyé qu'ici (seule son empreinte est stockée). */
  createRoleInvitation(input: InvitationInput, actorId: string): Promise<{ id: string; token: string; expiresAt: string }>;
  listRoleInvitations(): Promise<RoleInvitation[]>;
  revokeRoleInvitation(id: string, actorId: string): Promise<boolean>;
  previewRoleInvitation(token: string): Promise<InvitationPreview | null>;
  acceptRoleInvitation(token: string, profileId: string): Promise<{ role: RoleInvitation["role"]; organizationId: string | null }>;
}
