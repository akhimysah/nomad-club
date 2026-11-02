/**
 * Vague 2 · Contrats — fabrique les contrats d'exemple (texte, PDF, empreinte, preuve) à partir de CONTRATS_SEED.
 * Utilisé par le mode démo (demo-repo.ts) et par la génération de supabase/seed.sql (scripts/seed-sql/contrats.mjs).
 */
import { ACCEPT_STATEMENT } from "./signature-text.ts";
import { buildContractDocument, buildSchedule, MEMBERSHIP_PLAN_INFO, PARTNER_PLAN_INFO, type PlanInfo } from "./domain.ts";
import { CONTRATS_SEED, type SeedContract } from "./seed.ts";
import { INITIAL_TEMPLATES } from "./templates.ts";
import type { Contract, ContractAcceptance, ContractTemplate } from "./types.ts";

export type SeedPeople = {
  profile(id: string): { name: string; email: string | null; phone: string | null; card: string | null } | null;
  organization(id: string): { name: string; address: string | null; category: string | null } | null;
  /** Formule pro (libellé + avantages). */
  proPlan(code: string): PlanInfo | null;
};

export function initialTemplates(): ContractTemplate[] {
  return INITIAL_TEMPLATES.map((t) => ({
    id: t.id,
    kind: t.kind,
    version: t.version,
    title: t.title,
    bodyMd: t.bodyMd,
    effectiveFrom: t.effectiveFrom,
    active: true,
    notes: "Version initiale (brouillon à faire valider par un juriste).",
    createdBy: null,
    createdAt: `${t.effectiveFrom}T08:00:00.000Z`,
    activatedAt: `${t.effectiveFrom}T08:00:00.000Z`,
  }));
}

export async function buildSeedContract(s: SeedContract, people: SeedPeople, currency: string): Promise<{ contract: Contract; acceptance: ContractAcceptance | null }> {
  const tpl = INITIAL_TEMPLATES.find((t) => t.kind === s.kind)!;
  const signer = people.profile(s.profileId) ?? { name: "Signataire", email: null, phone: null, card: null };
  const organization = s.organizationId ? people.organization(s.organizationId) : null;
  const plan = s.kind === "membership" ? MEMBERSHIP_PLAN_INFO[s.plan] : s.kind === "partner" ? PARTNER_PLAN_INFO : (people.proPlan(s.plan) ?? { code: s.plan, label: s.plan, perks: "" });
  const schedule = buildSchedule(s.kind, s.amount, s.installments, s.startsOn);
  const doc = await buildContractDocument(
    tpl.bodyMd,
    { kind: s.kind, number: s.number, createdAt: s.createdAt, templateVersion: 1, signer, organization, plan, amount: s.amount, currency, installments: s.installments, schedule, startsOn: s.startsOn, endsOn: s.endsOn },
    tpl.title,
  );
  const contract: Contract = {
    id: s.id,
    number: s.number,
    kind: s.kind,
    templateId: tpl.id,
    templateVersion: 1,
    profileId: s.profileId,
    organizationId: s.organizationId,
    plan: s.plan,
    amount: s.amount,
    currency,
    installments: s.installments,
    schedule,
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    variables: doc.variables,
    bodyMd: doc.bodyMd,
    pdfSha256: doc.sha256,
    pdfPath: null,
    status: s.acceptance ? "accepted" : "pending",
    subscriptionRef: s.subscriptionRef,
    source: "seed",
    createdBy: null,
    createdAt: s.createdAt,
    acceptedAt: s.acceptance?.at ?? null,
    cancelledAt: null,
    cancelReason: null,
    remindedAt: s.remindedAt ?? null,
    reminderCount: s.remindedAt ? 1 : 0,
  };
  const acceptance: ContractAcceptance | null = s.acceptance
    ? {
        id: `acc-${s.id}`,
        contractId: s.id,
        profileId: s.profileId,
        signerName: signer.name,
        signerEmail: signer.email,
        acceptedAt: s.acceptance.at,
        ip: s.acceptance.ip,
        userAgent: s.acceptance.userAgent,
        templateVersion: 1,
        pdfSha256: doc.sha256,
        provider: "simple",
        providerRef: null,
        method: "checkbox",
        statement: ACCEPT_STATEMENT(s.number, 1),
      }
    : null;
  return { contract, acceptance };
}

export async function buildSeedContracts(people: SeedPeople, currency: string) {
  return Promise.all(CONTRATS_SEED.map((s) => buildSeedContract(s, people, currency)));
}
