/**
 * Vague 2 · Contrats — implémentation « démo » (mémoire du processus) du ContratsRepo.
 * Le magasin du module est initialisé paresseusement (les PDF d'exemple sont calculés pour leur empreinte) ;
 * les noms et établissements sont lus dans le jeu de démo principal (globalThis.__nomadDemoDb).
 * Mêmes règles que la base : preuve unique et immuable, modèle utilisé jamais modifié, une version active par type.
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../../clock";
import { fullName } from "../../format";
import { PRO_PLANS } from "../partenaires/domain";
import type { ProPlan } from "../partenaires/types";
import { createSeed, type SeedData } from "../../seed";
import type { AuditEntry } from "../../types";
import { appCurrency } from "./domain";
import type { ContratsRepo } from "./repo";
import { buildSeedContracts, initialTemplates, type SeedPeople } from "./seed-build";
import type { Contract, ContractAcceptance, ContractTemplate, ContractView } from "./types";

type Store = { templates: ContractTemplate[]; contracts: Contract[]; acceptances: ContractAcceptance[] };
type G = typeof globalThis & { __nomadDemoDb?: SeedData; __nomadContratsDb?: Promise<Store> };

function core(): SeedData {
  const g = globalThis as G;
  if (!g.__nomadDemoDb) g.__nomadDemoDb = createSeed();
  return g.__nomadDemoDb;
}

export function demoPeople(d: SeedData = core()): SeedPeople {
  return {
    profile(id) {
      const p = d.profiles.find((x) => x.id === id);
      return p ? { name: fullName(p).trim() || p.firstName, email: p.email, phone: p.whatsapp, card: p.cardNumber } : null;
    },
    organization(id) {
      const o = d.organizations.find((x) => x.id === id);
      return o ? { name: o.name, address: [o.address, o.area].filter(Boolean).join(", ") || null, category: o.category } : null;
    },
    proPlan(code) {
      const p = PRO_PLANS[code as ProPlan];
      return p ? { code, label: p.label, perks: p.perks.join(", ").toLowerCase() } : null;
    },
  };
}

async function createStore(): Promise<Store> {
  const built = await buildSeedContracts(demoPeople(), appCurrency());
  return {
    templates: initialTemplates(),
    contracts: built.map((b) => b.contract),
    acceptances: built.flatMap((b) => (b.acceptance ? [b.acceptance] : [])),
  };
}

function store(): Promise<Store> {
  const g = globalThis as G;
  if (!g.__nomadContratsDb) g.__nomadContratsDb = createStore();
  return g.__nomadContratsDb;
}

const clone = <T>(v: T): T => structuredClone(v);

function view(s: Store, c: Contract): ContractView {
  const d = core();
  const p = c.profileId ? d.profiles.find((x) => x.id === c.profileId) : null;
  const o = c.organizationId ? d.organizations.find((x) => x.id === c.organizationId) : null;
  const t = s.templates.find((x) => x.id === c.templateId);
  return clone({
    ...c,
    acceptance: s.acceptances.find((a) => a.contractId === c.id) ?? null,
    signerName: p ? fullName(p).trim() || p.firstName : (c.variables["signataire.nom"] ?? "—"),
    organizationName: o?.name ?? null,
    templateTitle: t?.title ?? "Modèle",
  });
}

const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt < b.createdAt ? 1 : -1);

export const demoContratsRepo: ContratsRepo = {
  async listContractTemplates(kind) {
    const s = await store();
    return clone(s.templates.filter((t) => !kind || t.kind === kind).sort((a, b) => (a.kind === b.kind ? b.version - a.version : a.kind < b.kind ? -1 : 1)));
  },
  async getContractTemplate(id) {
    const t = (await store()).templates.find((x) => x.id === id);
    return t ? clone(t) : null;
  },
  async getActiveContractTemplate(kind) {
    const t = (await store()).templates.find((x) => x.kind === kind && x.active);
    return t ? clone(t) : null;
  },
  async createContractTemplate(input, actorId) {
    const s = await store();
    const version = Math.max(0, ...s.templates.filter((t) => t.kind === input.kind).map((t) => t.version)) + 1;
    const t: ContractTemplate = { id: randomUUID(), ...input, version, active: false, createdBy: actorId, createdAt: nowIso(), activatedAt: null };
    s.templates.push(t);
    return clone(t);
  },
  async activateContractTemplate(id) {
    const s = await store();
    const t = s.templates.find((x) => x.id === id);
    if (!t) return null;
    s.templates.forEach((x) => {
      if (x.kind === t.kind) x.active = x.id === id;
    });
    t.activatedAt = nowIso();
    return clone(t);
  },

  async listContracts(f = {}) {
    const s = await store();
    return s.contracts
      .filter(
        (c) =>
          (!f.kind || c.kind === f.kind) &&
          (!f.status || c.status === f.status) &&
          (!f.from || c.createdAt.slice(0, 10) >= f.from) &&
          (!f.to || c.createdAt.slice(0, 10) <= f.to) &&
          (!f.profileId || c.profileId === f.profileId) &&
          (!f.organizationId || c.organizationId === f.organizationId),
      )
      .sort(byNewest)
      .map((c) => view(s, c));
  },
  async listMyContracts(profileId) {
    const s = await store();
    const owned = new Set(core().organizationMembers.filter((m) => m.profileId === profileId && m.role === "owner").map((m) => m.organizationId));
    return s.contracts
      .filter((c) => c.profileId === profileId || (c.organizationId && owned.has(c.organizationId)))
      .sort(byNewest)
      .map((c) => view(s, c));
  },
  async getContract(id) {
    const s = await store();
    const c = s.contracts.find((x) => x.id === id);
    return c ? view(s, c) : null;
  },
  async findOpenContract(q) {
    const s = await store();
    const c = s.contracts
      .filter((x) => x.status !== "cancelled" && x.profileId === q.profileId && x.kind === q.kind && x.plan === q.plan && (x.organizationId ?? null) === q.organizationId && x.createdAt >= q.sinceIso)
      .sort(byNewest)[0];
    return c ? clone(c) : null;
  },
  async insertContract(row) {
    const s = await store();
    if (s.contracts.some((c) => c.number === row.number)) throw new Error("Numéro de contrat déjà utilisé.");
    const tpl = s.templates.find((t) => t.id === row.templateId);
    if (!tpl || tpl.kind !== row.kind) throw new Error("Modèle de contrat introuvable.");
    const c: Contract = {
      ...row,
      id: row.id ?? randomUUID(),
      templateVersion: tpl.version,
      status: "pending",
      createdAt: row.createdAt ?? nowIso(),
      acceptedAt: null,
      cancelledAt: null,
      cancelReason: null,
      remindedAt: null,
      reminderCount: 0,
    };
    s.contracts.push(c);
    return clone(c);
  },
  async acceptContract(input) {
    const s = await store();
    const c = s.contracts.find((x) => x.id === input.contractId);
    if (!c) throw new Error("Contrat introuvable.");
    if (c.profileId !== input.profileId) throw new Error("Seule la signataire peut accepter ce contrat.");
    if (c.status !== "pending" || s.acceptances.some((a) => a.contractId === c.id)) throw new Error("Ce contrat n’est plus en attente d’acceptation.");
    if (c.pdfSha256 !== input.pdfSha256) throw new Error("Le document a changé : recharge la page avant d’accepter.");
    const p = core().profiles.find((x) => x.id === input.profileId);
    const a: ContractAcceptance = {
      id: randomUUID(),
      contractId: c.id,
      profileId: input.profileId,
      signerName: p ? fullName(p).trim() || p.firstName : (c.variables["signataire.nom"] ?? "Signataire"),
      signerEmail: p?.email ?? null,
      acceptedAt: nowIso(),
      ip: input.ip?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      templateVersion: c.templateVersion,
      pdfSha256: c.pdfSha256,
      provider: input.provider,
      providerRef: input.providerRef,
      method: "checkbox",
      statement: input.statement,
    };
    s.acceptances.push(a);
    c.status = "accepted";
    c.acceptedAt = a.acceptedAt;
    return clone(a);
  },
  async linkContractSubscription(contractId, reference) {
    const c = (await store()).contracts.find((x) => x.id === contractId);
    if (c && !c.subscriptionRef) c.subscriptionRef = reference.slice(0, 120);
  },
  async cancelContract(contractId, reason) {
    const c = (await store()).contracts.find((x) => x.id === contractId);
    if (!c || c.status === "cancelled") return;
    c.status = "cancelled";
    c.cancelledAt = nowIso();
    c.cancelReason = reason;
  },
  async markContractReminded(contractId) {
    const c = (await store()).contracts.find((x) => x.id === contractId);
    if (!c) return;
    c.remindedAt = nowIso();
    c.reminderCount += 1;
  },
  async storeContractPdf() {
    return null; // démo : le PDF est régénéré à la volée (rendu déterministe, empreinte vérifiée)
  },
  async contractPdfDelivery() {
    return { kind: "regenerate" };
  },
  async logContractAudit(entry) {
    const row: AuditEntry = { id: randomUUID(), actorId: entry.actorId, action: entry.action, targetType: entry.targetType, targetId: entry.targetId, summary: entry.summary, details: entry.details ?? {}, createdAt: nowIso() };
    core().auditLog.push(row);
  },
};
