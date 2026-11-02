"use server";

/**
 * Vague 2 · Contrats — server actions : étape « Contrat » des parcours (préparer, accepter), « Mes contrats »,
 * back-office (relance, annulation, génération manuelle, modèles). Tout est vérifié côté serveur.
 */
import { revalidatePath } from "next/cache";
import { checkCapability, getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { appCurrency, dateLong, formatAmount, MEMBERSHIP_INSTALLMENTS } from "@/lib/modules/contrats/domain";
import { CONTRACTS_HOME, KIND_LABEL } from "@/lib/modules/contrats/labels";
import { parseBlocks, type Block } from "@/lib/modules/contrats/render";
import {
  acceptContract,
  activateTemplate,
  cancelContractAdmin,
  canReadContract,
  createTemplateVersion,
  expectedAmount,
  generateContract,
  isPlanFor,
  planInfo,
  prepareContract,
  remindContract,
  requireContractAcceptance,
  type PrepareRequest,
} from "@/lib/modules/contrats/service";
import { ACCEPT_STATEMENT } from "@/lib/modules/contrats/signature-text";
import { CONTRACT_KINDS, type ContractKind, type ContractView } from "@/lib/modules/contrats/types";
import "@/lib/modules/contrats/register";

/** Ce que l'écran « Contrat » affiche (aucune donnée d'une autre personne). */
export type ContractClientView = {
  id: string;
  number: string;
  kind: ContractKind;
  title: string;
  status: ContractView["status"];
  version: number;
  sha256: string;
  planLabel: string;
  amountLabel: string;
  scheduleLines: string[];
  statement: string;
  pdfUrl: string;
  blocks: Block[];
  acceptedAt: string | null;
};

function pdfUrl(c: ContractView): string {
  return `${CONTRACTS_HOME[c.kind]}/${c.id}/pdf`;
}

function toClient(c: ContractView): ContractClientView {
  const info = planInfo(c.kind, c.plan);
  return {
    id: c.id,
    number: c.number,
    kind: c.kind,
    title: c.templateTitle,
    status: c.status,
    version: c.templateVersion,
    sha256: c.pdfSha256,
    planLabel: info?.label ?? c.plan,
    amountLabel: c.kind === "partner" ? "Sans frais" : c.kind === "pro" ? `${formatAmount(c.amount, c.currency)} / mois` : formatAmount(c.amount, c.currency),
    scheduleLines: c.schedule.map((s) => (c.kind === "pro" ? `${formatAmount(s.amount, c.currency)} le ${dateLong(s.dueOn)}, puis chaque mois` : `${formatAmount(s.amount, c.currency)} le ${dateLong(s.dueOn)}`)),
    statement: ACCEPT_STATEMENT(c.number, c.templateVersion),
    pdfUrl: pdfUrl(c),
    blocks: parseBlocks(c.bodyMd),
    acceptedAt: c.acceptedAt,
  };
}

const isKind = (v: unknown): v is ContractKind => typeof v === "string" && (CONTRACT_KINDS as readonly string[]).includes(v);

export type PrepareResult = { ok: true; alreadyAccepted: boolean; contract: ContractClientView } | { ok: false; error: string };

/** Étape « Contrat » : le contrat à lire pour cette souscription (généré au besoin). */
export async function prepareContractAction(req: PrepareRequest): Promise<PrepareResult> {
  const v = await getViewer();
  if (!v.profile) return { ok: false, error: "Connecte-toi pour lire ton contrat." };
  if (!isKind(req.kind) || typeof req.plan !== "string") return { ok: false, error: "Demande invalide." };
  try {
    const r = await prepareContract(v, {
      kind: req.kind,
      plan: req.plan,
      organizationId: typeof req.organizationId === "string" ? req.organizationId : null,
      installments: typeof req.installments === "number" ? req.installments : 1,
      action: req.action === "renew" || req.action === "upgrade" ? req.action : "join",
    });
    return { ok: true, alreadyAccepted: r.alreadyAccepted, contract: toClient(r.contract) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Contrat indisponible." };
  }
}

/** Un contrat existant (Mes contrats, back-office). */
export async function loadContractAction(id: string): Promise<PrepareResult> {
  const v = await getViewer();
  const c = typeof id === "string" ? await getRepo().getContract(id) : null;
  if (!c || !(await canReadContract(v, c))) return { ok: false, error: "Contrat introuvable." };
  return { ok: true, alreadyAccepted: c.status === "accepted", contract: toClient(c) };
}

/** Faut-il accepter un contrat avant de payer ? (appelé par les écrans de souscription) */
export async function contractRequirementAction(kind: ContractKind, plan: string, organizationId: string | null = null): Promise<{ required: boolean; contractId: string | null }> {
  if (!isKind(kind)) return { required: false, contractId: null };
  const r = await requireContractAcceptance(kind, plan, { organizationId });
  return { required: r.required, contractId: r.contractId };
}

export async function acceptContractAction(id: string, sha256: string, checked: boolean): Promise<{ ok: boolean; message: string }> {
  const v = await getViewer();
  const r = await acceptContract(v, String(id), String(sha256), checked === true);
  if (!r.ok) return { ok: false, message: r.error };
  revalidatePath(CONTRACTS_HOME[r.contract.kind]);
  revalidatePath("/fondatrices/contrats", "layout");
  return { ok: true, message: r.emailed ? "Contrat accepté. Une copie PDF part par e-mail." : "Contrat accepté. Ta copie PDF est dans « Mes contrats »." };
}

/* =====================================================================
   Back-office (contracts.manage)
   ===================================================================== */

export async function remindContractAction(id: string): Promise<{ ok: boolean; message: string }> {
  const me = await checkCapability("contracts.manage");
  if (!me) return { ok: false, message: "Réservé aux fondatrices." };
  const r = await remindContract(me.profile.id, id);
  revalidatePath("/fondatrices/contrats", "layout");
  return r;
}

export async function cancelContractAction(id: string, reason: string): Promise<{ ok: boolean; message: string }> {
  const me = await checkCapability("contracts.manage");
  if (!me) return { ok: false, message: "Réservé aux fondatrices." };
  const r = await cancelContractAdmin(me.profile.id, id, String(reason ?? ""));
  revalidatePath("/fondatrices/contrats", "layout");
  return r;
}

export type FormState = { ok: boolean; message: string; id?: string } | null;

/** Génération manuelle (ex. contrat partenaire préparé par les fondatrices) : le contrat part « à accepter ». */
export async function generateContractAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await checkCapability("contracts.manage");
  if (!me) return { ok: false, message: "Réservé aux fondatrices." };
  const kind = String(fd.get("kind") ?? "");
  const profileId = String(fd.get("profileId") ?? "");
  const organizationId = String(fd.get("organizationId") ?? "") || null;
  const plan = String(fd.get("plan") ?? "");
  const startsOn = String(fd.get("startsOn") ?? "");
  const installments = Number(fd.get("installments") ?? 1);
  const amountRaw = String(fd.get("amount") ?? "").replace(",", ".").trim();
  if (!isKind(kind)) return { ok: false, message: "Type de contrat inconnu." };
  if (!isPlanFor(kind, plan)) return { ok: false, message: "Formule inconnue pour ce type." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { ok: false, message: "Date de début invalide." };
  const profile = await getRepo().getProfile(profileId);
  if (!profile) return { ok: false, message: "Choisis la signataire." };
  if (kind !== "membership") {
    if (!organizationId) return { ok: false, message: "Choisis l’établissement." };
    const members = await getRepo().listOrganizationMembers(organizationId);
    if (!members.some((m) => m.profileId === profileId)) return { ok: false, message: "La signataire doit faire partie de l’équipe de l’établissement." };
  }
  const amount = amountRaw ? Number(amountRaw) : expectedAmount(kind, plan);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return { ok: false, message: "Montant invalide." };
  const n = kind === "membership" && (MEMBERSHIP_INSTALLMENTS as readonly number[]).includes(installments) ? installments : 1;
  const endsOn = kind === "pro" ? null : `${Number(startsOn.slice(0, 4)) + 1}${startsOn.slice(4)}`;
  try {
    const c = await generateContract({ kind, plan, profileId, organizationId: kind === "membership" ? null : organizationId, amount, currency: appCurrency(), installments: n, startsOn, endsOn, source: "admin", actorId: me.profile.id });
    revalidatePath("/fondatrices/contrats", "layout");
    return { ok: true, message: `Contrat ${c.number} généré (${KIND_LABEL[kind]}). Il attend l’acceptation de ${profile.firstName}.`, id: c.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Génération impossible." };
  }
}

export async function createTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await checkCapability("contracts.manage");
  if (!me) return { ok: false, message: "Réservé aux fondatrices." };
  const kind = String(fd.get("kind") ?? "");
  if (!isKind(kind)) return { ok: false, message: "Type de modèle inconnu." };
  const r = await createTemplateVersion(me.profile.id, {
    kind,
    title: String(fd.get("title") ?? "").trim(),
    bodyMd: String(fd.get("bodyMd") ?? "").replace(/\r\n/g, "\n"),
    effectiveFrom: String(fd.get("effectiveFrom") ?? ""),
    notes: String(fd.get("notes") ?? "").trim() || null,
  });
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/fondatrices/contrats", "layout");
  return { ok: true, message: `Version ${r.template.version} enregistrée (inactive). Relis-la puis active-la.`, id: r.template.id };
}

export async function activateTemplateAction(id: string): Promise<{ ok: boolean; message: string }> {
  const me = await checkCapability("contracts.manage");
  if (!me) return { ok: false, message: "Réservé aux fondatrices." };
  const r = await activateTemplate(me.profile.id, id);
  revalidatePath("/fondatrices/contrats", "layout");
  return r;
}
