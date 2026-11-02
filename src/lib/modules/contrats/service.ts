/**
 * Vague 2 · Contrats — logique serveur : génération, exigence d'acceptation avant paiement, acceptation (preuve,
 * notification, e-mail avec le PDF), souscription activée, relances, modèles, téléchargement.
 * Toutes les écritures passent par getRepo() (démo ou Supabase) ; rien ici n'est exposé au navigateur.
 */
import { headers } from "next/headers";
import { getViewer, viewerCan } from "../../auth";
import { nowIso, today } from "../../clock";
import { getRepo } from "../../data";
import { applyMembership, membershipAmount } from "../../domain/membership";
import { sendEmail } from "../../mail-hook";
import { notify } from "../../notify";
import type { SubscriptionActivated } from "../../payment-hooks";
import type { MembershipAction, PaidPlan, Profile, Viewer } from "../../types";
import { isProPlan, PRO_PLANS } from "../partenaires/domain";
import { appCurrency, buildContractDocument, buildSchedule, contractNumber, contractPdf, dateLong, formatAmount, MEMBERSHIP_INSTALLMENTS, MEMBERSHIP_PLAN_INFO, PARTNER_PLAN_INFO, sha256Hex, type PlanInfo } from "./domain";
import { CONTRACTS_HOME, KIND_LABEL, KIND_LONG } from "./labels";
import { renderCertificatePdf } from "./pdf";
import { unknownVariables } from "./render";
import { getSignatureProvider } from "./signature";
import { ACCEPT_STATEMENT } from "./signature-text";
import type { Contract, ContractKind, ContractSource, ContractView, NewTemplateInput } from "./types";

/* =====================================================================
   Formules et montants
   ===================================================================== */

export function planInfo(kind: ContractKind, plan: string): PlanInfo | null {
  if (kind === "membership") return MEMBERSHIP_PLAN_INFO[plan] ?? null;
  if (kind === "partner") return PARTNER_PLAN_INFO;
  if (!isProPlan(plan)) return null;
  const p = PRO_PLANS[plan];
  return { code: plan, label: p.label, perks: p.perks.join(", ").toLowerCase() };
}

export function isPlanFor(kind: ContractKind, plan: string): boolean {
  return planInfo(kind, plan) !== null;
}

/** Montant de la souscription calculé côté serveur (jamais fourni par le navigateur). */
export function expectedAmount(kind: ContractKind, plan: string, action: MembershipAction = "join"): number {
  if (kind === "membership") return membershipAmount(action, plan === "premium" ? "premium" : "member");
  if (kind === "pro") return isProPlan(plan) ? PRO_PLANS[plan].price : 0;
  return 0;
}

function membershipDates(p: Profile, action: MembershipAction, plan: string): { startsOn: string; endsOn: string } {
  const r = applyMembership(p, action, plan === "premium" ? "premium" : ("member" as PaidPlan), today());
  return { startsOn: r.startsAt, endsOn: r.planEndsAt };
}

/* =====================================================================
   Génération
   ===================================================================== */

export type GenerateInput = {
  kind: ContractKind;
  plan: string;
  profileId: string;
  organizationId: string | null;
  amount: number;
  currency: string;
  installments: number;
  startsOn: string;
  endsOn: string | null;
  source: ContractSource;
  actorId: string | null;
  subscriptionRef?: string | null;
};

/** Génère un contrat « en attente » : numéro unique, variables, texte, PDF, empreinte, dépôt, journal. */
export async function generateContract(input: GenerateInput): Promise<Contract> {
  const repo = getRepo();
  const template = await repo.getActiveContractTemplate(input.kind);
  if (!template) throw new Error(`Aucun modèle actif pour le type « ${KIND_LABEL[input.kind]} ».`);
  const info = planInfo(input.kind, input.plan);
  if (!info) throw new Error("Formule inconnue pour ce contrat.");
  const parties = await repo.contractParties(input.profileId, input.organizationId);
  if (!parties.signer) throw new Error("Signataire introuvable.");
  if (input.kind !== "membership" && !parties.organization) throw new Error("Établissement introuvable.");
  const installments = input.kind === "membership" ? input.installments : 1;
  const schedule = buildSchedule(input.kind, input.amount, installments, input.startsOn);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const createdAt = nowIso();
    const number = contractNumber(input.kind, Number(createdAt.slice(0, 4)));
    const doc = await buildContractDocument(
      template.bodyMd,
      {
        kind: input.kind,
        number,
        createdAt,
        templateVersion: template.version,
        signer: parties.signer,
        organization: parties.organization,
        plan: info,
        amount: input.amount,
        currency: input.currency,
        installments,
        schedule,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
      },
      template.title,
    );
    try {
      const contract = await repo.insertContract({
        number,
        kind: input.kind,
        templateId: template.id,
        templateVersion: template.version,
        profileId: input.profileId,
        organizationId: input.organizationId,
        plan: input.plan,
        amount: input.amount,
        currency: input.currency,
        installments,
        schedule,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        variables: doc.variables,
        bodyMd: doc.bodyMd,
        pdfSha256: doc.sha256,
        pdfPath: null,
        subscriptionRef: input.subscriptionRef ?? null,
        source: input.source,
        createdBy: input.actorId,
        createdAt,
      });
      const path = await repo.storeContractPdf(contract, doc.pdf);
      await repo.logContractAudit({
        actorId: input.actorId ?? input.profileId,
        action: "contract.generate",
        targetType: "contract",
        targetId: contract.id,
        summary: `Contrat ${contract.number} généré (${KIND_LABEL[contract.kind]} · ${info.label} · ${formatAmount(contract.amount, contract.currency)})`,
        details: { number: contract.number, kind: contract.kind, plan: contract.plan, version: template.version, sha256: doc.sha256, source: input.source, profileId: input.profileId, organizationId: input.organizationId },
      });
      return { ...contract, pdfPath: path };
    } catch (e) {
      lastError = e;
      if (!(e instanceof Error) || !/number|numéro|duplicate|unique/i.test(e.message)) throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Génération du contrat impossible.");
}

/* =====================================================================
   Exigence d'acceptation (parcours de souscription)
   ===================================================================== */

export type ContractRequirement =
  | { required: false; contractId: string }
  | { required: true; contractId: string | null; reason: "missing" | "pending" };

type ReqOpts = { organizationId?: string | null; profileId?: string };

/**
 * Faut-il faire accepter un contrat avant de payer cette souscription ?
 * - adhésion : un contrat par souscription (adhésion, renouvellement, passage Premium) ; un contrat accepté
 *   depuis moins de 7 jours et pas encore relié à un paiement suffit (paiement réessayé) ;
 * - pro : un contrat accepté pour l'établissement et la formule couvre les renouvellements mensuels ;
 * - partenaire : un contrat accepté pour l'établissement suffit.
 * Sans personne connectée : exigé (le contrat sera généré après la souscription et accepté ensuite).
 */
export async function requireContractAcceptance(kind: ContractKind, plan: string, opts: ReqOpts = {}): Promise<ContractRequirement> {
  const profileId = opts.profileId ?? (await getViewer()).profile?.id;
  if (!profileId) return { required: true, contractId: null, reason: "missing" };
  const repo = getRepo();
  const since = kind === "membership" ? new Date(Date.parse(nowIso()) - 7 * 86400000).toISOString() : "1970-01-01T00:00:00.000Z";
  const open = await repo.findOpenContract({ profileId, kind, plan, organizationId: kind === "membership" ? null : (opts.organizationId ?? null), sinceIso: since });
  if (!open || (kind === "membership" && open.subscriptionRef)) return { required: true, contractId: null, reason: "missing" };
  if (open.status === "accepted") return { required: false, contractId: open.id };
  return { required: true, contractId: open.id, reason: "pending" };
}

export type PrepareRequest = { kind: ContractKind; plan: string; organizationId?: string | null; installments?: number; action?: MembershipAction };

/** Droits de la personne sur l'établissement (propriétaire ou collaboratrice). */
async function canSignFor(v: Viewer, organizationId: string | null | undefined): Promise<boolean> {
  if (!v.profile || !organizationId) return false;
  const mine = await getRepo().listMyOrganizations(v.profile.id);
  return mine.some((m) => m.organization.id === organizationId);
}

/**
 * Étape « Contrat » d'un parcours : renvoie le contrat à lire (le génère au besoin) ou celui déjà accepté.
 * Le montant, l'échéancier et les dates sont recalculés côté serveur.
 */
export async function prepareContract(v: Viewer, req: PrepareRequest): Promise<{ contract: ContractView; alreadyAccepted: boolean }> {
  if (!v.profile) throw new Error("Connecte-toi pour lire ton contrat.");
  if (!isPlanFor(req.kind, req.plan)) throw new Error("Formule inconnue.");
  const orgId = req.kind === "membership" ? null : (req.organizationId ?? null);
  if (req.kind !== "membership" && !(await canSignFor(v, orgId))) throw new Error("Tu ne peux pas signer pour cet établissement.");
  const repo = getRepo();
  const need = await requireContractAcceptance(req.kind, req.plan, { organizationId: orgId, profileId: v.profile.id });
  const action: MembershipAction = req.action ?? "join";
  const amount = expectedAmount(req.kind, req.plan, action);
  const installments = req.kind === "membership" && (MEMBERSHIP_INSTALLMENTS as readonly number[]).includes(req.installments ?? 1) ? (req.installments ?? 1) : 1;
  if (need.contractId) {
    const existing = await repo.getContract(need.contractId);
    const active = await repo.getActiveContractTemplate(req.kind);
    if (existing && (!need.required || (existing.amount === amount && existing.installments === installments && existing.templateId === active?.id))) {
      return { contract: existing, alreadyAccepted: !need.required };
    }
    // contrat en attente devenu caduc (autre montant, autre échéancier ou nouveau modèle) : on le remplace
    if (existing && existing.status === "pending") await repo.cancelContract(existing.id, "Remplacé par un nouveau contrat avant acceptation.");
  }
  const dates = req.kind === "membership" ? membershipDates(v.profile, action, req.plan) : { startsOn: today(), endsOn: req.kind === "partner" ? addYearsYmd(today(), 1) : null };
  const created = await generateContract({
    kind: req.kind,
    plan: req.plan,
    profileId: v.profile.id,
    organizationId: orgId,
    amount,
    currency: appCurrency(),
    installments,
    startsOn: dates.startsOn,
    endsOn: dates.endsOn,
    source: "checkout",
    actorId: v.profile.id,
  });
  const view = await repo.getContract(created.id);
  if (!view) throw new Error("Contrat introuvable après génération.");
  return { contract: view, alreadyAccepted: false };
}

function addYearsYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y + n, m - 1, d)).toISOString().slice(0, 10);
}

/* =====================================================================
   Acceptation
   ===================================================================== */

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
    return { ip: ip ? ip.slice(0, 64) : null, userAgent: h.get("user-agent")?.slice(0, 512) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Octets du PDF d'un contrat (régénérés à l'identique, empreinte vérifiée). */
export async function contractPdfBytes(c: Contract): Promise<Uint8Array> {
  const pdf = await contractPdf({ number: c.number, bodyMd: c.bodyMd, createdAt: c.createdAt, templateVersion: c.templateVersion, title: c.number });
  if (sha256Hex(pdf) !== c.pdfSha256) throw new Error(`Empreinte du contrat ${c.number} différente : document altéré ou rendu modifié.`);
  return pdf;
}

export type AcceptResult = { ok: true; contract: ContractView; emailed: boolean } | { ok: false; error: string };

/** La signataire accepte (case cochée) : preuve enregistrée, notification, e-mail avec le PDF en pièce jointe. */
export async function acceptContract(v: Viewer, contractId: string, pdfSha256: string, checked: boolean): Promise<AcceptResult> {
  if (!v.profile) return { ok: false, error: "Connecte-toi pour accepter ton contrat." };
  if (!checked) return { ok: false, error: "Coche « J’ai lu et j’accepte » pour continuer." };
  const repo = getRepo();
  const c = await repo.getContract(contractId);
  if (!c || c.profileId !== v.profile.id) return { ok: false, error: "Contrat introuvable." };
  if (c.status !== "pending") return c.status === "accepted" ? { ok: true, contract: c, emailed: false } : { ok: false, error: "Ce contrat a été annulé." };
  const meta = await requestMeta();
  try {
    await getSignatureProvider().accept({ contractId, profileId: v.profile.id, pdfSha256, ip: meta.ip, userAgent: meta.userAgent, statement: ACCEPT_STATEMENT(c.number, c.templateVersion) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Acceptation impossible." };
  }
  const done = (await repo.getContract(contractId)) ?? c;
  const link = CONTRACTS_HOME[c.kind];
  await notify([{ recipientId: v.profile.id, type: "contract_accepted", title: "Contrat accepté", body: `Ton contrat ${c.number} est accepté. Une copie PDF est disponible dans « Mes contrats ».`, link }]);
  let emailed = false;
  if (v.profile.email) {
    try {
      const pdf = await contractPdfBytes(done);
      emailed = await sendEmail({
        template: "contract_accepted",
        to: v.profile.email,
        data: { firstName: v.profile.firstName, contractTitle: c.templateTitle || KIND_LONG[c.kind], reference: c.number, acceptedAt: done.acceptedAt ? `${dateLong(done.acceptedAt)} à ${new Date(done.acceptedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })}` : "", sha256: c.pdfSha256, contractUrl: link },
        attachments: [{ filename: `${c.number}.pdf`, content: pdf, contentType: "application/pdf" }],
      });
    } catch (e) {
      console.error("[contrats] e-mail d'acceptation", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, contract: done, emailed };
}

/* =====================================================================
   Souscription activée (point d'extension du chantier paiements)
   ===================================================================== */

const DOUBLE_EMIT_MS = 2 * 86400000;

/**
 * Appelé par onSubscriptionActivated (voir register.ts). Relie la souscription au contrat déjà préparé
 * (étape « Contrat » avant paiement) ou en génère un, à accepter ensuite (notification + e-mail).
 * Idempotent : un même événement émis deux fois ne crée pas deux contrats.
 */
export async function handleSubscriptionActivated(e: SubscriptionActivated): Promise<Contract | null> {
  const kind: ContractKind = e.kind === "membership" ? "membership" : e.kind === "partner" ? "partner" : "pro";
  if (!isPlanFor(kind, e.plan)) {
    console.warn("[contrats] formule inconnue, contrat non généré", e.kind, e.plan);
    return null;
  }
  const repo = getRepo();
  const orgId = kind === "membership" ? null : (e.organizationId ?? null);
  const since = kind === "membership" ? new Date(Date.parse(nowIso()) - 30 * 86400000).toISOString() : "1970-01-01T00:00:00.000Z";
  const open = await repo.findOpenContract({ profileId: e.profileId, kind, plan: e.plan, organizationId: orgId, sinceIso: since });
  if (open) {
    if (!open.subscriptionRef) {
      await repo.linkContractSubscription(open.id, e.reference);
      await repo.logContractAudit({ actorId: e.profileId, action: "contract.link", targetType: "contract", targetId: open.id, summary: `Contrat ${open.number} relié à la souscription ${e.reference}`, details: { reference: e.reference } });
      return open;
    }
    const recent = Date.parse(nowIso()) - Date.parse(open.createdAt) < DOUBLE_EMIT_MS;
    if (open.subscriptionRef === e.reference || recent || kind !== "membership") return open;
  }
  const contract = await generateContract({
    kind,
    plan: e.plan,
    profileId: e.profileId,
    organizationId: orgId,
    amount: e.amount,
    currency: /^[A-Z]{3}$/.test(e.currency) ? e.currency : appCurrency(),
    installments: Math.max(1, Math.min(12, e.installments || 1)),
    startsOn: e.startsAt.slice(0, 10),
    endsOn: e.endsAt ? e.endsAt.slice(0, 10) : null,
    source: "subscription",
    actorId: null,
    subscriptionRef: e.reference,
  });
  await announceReady(contract, false);
  return contract;
}

/** Prévient la signataire qu'un contrat l'attend (notification + e-mail si le module e-mails est branché). */
async function announceReady(c: Contract, reminder: boolean): Promise<void> {
  if (!c.profileId) return;
  const link = CONTRACTS_HOME[c.kind];
  await notify([
    {
      recipientId: c.profileId,
      type: "contract_ready",
      title: reminder ? "Rappel : ton contrat attend ton accord" : "Ton contrat est prêt",
      body: `Contrat ${c.number} (${KIND_LABEL[c.kind]}) : à lire et accepter en ligne.`,
      link,
    },
  ]);
  const parties = await getRepo().contractParties(c.profileId, c.organizationId);
  if (parties.signer?.email) {
    await sendEmail({
      template: reminder ? "contract_reminder" : "contract_ready",
      to: parties.signer.email,
      data: { firstName: parties.signer.firstName, contractTitle: KIND_LONG[c.kind], reference: c.number, contractUrl: link },
    });
  }
}

/* =====================================================================
   Back-office
   ===================================================================== */

export async function remindContract(actorId: string, contractId: string): Promise<{ ok: boolean; message: string }> {
  const repo = getRepo();
  const c = await repo.getContract(contractId);
  if (!c) return { ok: false, message: "Contrat introuvable." };
  if (c.status !== "pending") return { ok: false, message: "Seul un contrat en attente peut être relancé." };
  await repo.markContractReminded(c.id);
  await announceReady(c, true);
  await repo.logContractAudit({ actorId, action: "contract.remind", targetType: "contract", targetId: c.id, summary: `Relance du contrat ${c.number} (${c.signerName})`, details: { count: c.reminderCount + 1 } });
  return { ok: true, message: `Relance envoyée à ${c.signerName}.` };
}

export async function cancelContractAdmin(actorId: string, contractId: string, reason: string): Promise<{ ok: boolean; message: string }> {
  const repo = getRepo();
  const c = await repo.getContract(contractId);
  if (!c) return { ok: false, message: "Contrat introuvable." };
  if (c.status === "cancelled") return { ok: false, message: "Contrat déjà annulé." };
  const why = reason.trim().slice(0, 500);
  if (why.length < 3) return { ok: false, message: "Indique le motif de l’annulation." };
  await repo.cancelContract(c.id, why);
  await repo.logContractAudit({ actorId, action: "contract.cancel", targetType: "contract", targetId: c.id, summary: `Contrat ${c.number} annulé : ${why}`, details: { previous: c.status } });
  return { ok: true, message: c.status === "accepted" ? "Contrat résilié (la preuve d’acceptation est conservée)." : "Contrat annulé." };
}

export function validateTemplate(input: NewTemplateInput): string | null {
  if (input.title.trim().length < 3) return "Donne un titre au modèle.";
  if (input.bodyMd.trim().length < 200) return "Le texte du modèle est trop court.";
  if (input.bodyMd.length > 200000) return "Le texte du modèle est trop long.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) return "Date de mise en vigueur invalide.";
  if (!/^#\s+/m.test(input.bodyMd)) return "Le texte doit commencer par un titre (« # Titre »).";
  const unknown = unknownVariables(input.bodyMd);
  if (unknown.length) return `Variables inconnues : ${unknown.map((u) => `{{${u}}}`).join(", ")}.`;
  return null;
}

export async function createTemplateVersion(actorId: string, input: NewTemplateInput) {
  const err = validateTemplate(input);
  if (err) return { ok: false as const, message: err };
  const t = await getRepo().createContractTemplate(input, actorId);
  await getRepo().logContractAudit({ actorId, action: "contract_template.create", targetType: "contract_template", targetId: t.id, summary: `Modèle ${KIND_LABEL[t.kind]} : version ${t.version} créée`, details: { kind: t.kind, version: t.version, effectiveFrom: t.effectiveFrom } });
  return { ok: true as const, template: t };
}

export async function activateTemplate(actorId: string, id: string) {
  const t = await getRepo().activateContractTemplate(id, actorId);
  if (!t) return { ok: false, message: "Modèle introuvable." };
  await getRepo().logContractAudit({ actorId, action: "contract_template.activate", targetType: "contract_template", targetId: t.id, summary: `Modèle ${KIND_LABEL[t.kind]} : version ${t.version} activée`, details: { kind: t.kind, version: t.version } });
  return { ok: true, message: `Version ${t.version} active : les nouveaux contrats l’utilisent. Les contrats existants gardent la leur.` };
}

/* =====================================================================
   Téléchargement (routes /…/contrats/[id]/pdf)
   ===================================================================== */

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** La personne peut-elle lire ce contrat ? (signataire, propriétaire de l'établissement, administratrice) */
export async function canReadContract(v: Viewer, c: Contract): Promise<boolean> {
  if (!v.profile) return false;
  if (viewerCan(v, "contracts.manage")) return true;
  if (c.profileId === v.profile.id) return true;
  if (!c.organizationId) return false;
  const mine = await getRepo().listMyOrganizations(v.profile.id);
  return mine.some((m) => m.organization.id === c.organizationId && m.role === "owner");
}

function certificateRows(c: ContractView): Array<[string, string]> {
  const a = c.acceptance!;
  return [
    ["Contrat", `${c.number} · ${c.templateTitle}`],
    ["Modèle", `version ${a.templateVersion}`],
    ["Signataire", `${a.signerName}${a.signerEmail ? ` (${a.signerEmail})` : ""}`],
    ...(c.organizationName ? ([["Établissement", c.organizationName]] as Array<[string, string]>) : []),
    ["Accepté le", `${new Date(a.acceptedAt).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", dateStyle: "long", timeStyle: "medium" })} (heure de Marrakech) · ${a.acceptedAt}`],
    ["Adresse IP", a.ip ?? "non relevée"],
    ["Navigateur", a.userAgent ?? "non relevé"],
    ["Méthode", a.provider === "simple" ? "Acceptation électronique simple (case à cocher)" : `${a.provider}${a.providerRef ? ` · ${a.providerRef}` : ""}`],
    ["Phrase acceptée", a.statement],
    ["Empreinte SHA-256 du PDF", a.pdfSha256],
  ];
}

export async function serveContractPdf(id: string, opts: { certificate?: boolean } = {}): Promise<Response> {
  const v = await getViewer();
  if (!v.profile) return new Response("Connecte-toi pour télécharger tes contrats.", { status: 401, headers: NO_STORE });
  const c = await getRepo().getContract(id);
  if (!c || !(await canReadContract(v, c))) return new Response("Contrat introuvable.", { status: 404, headers: NO_STORE });
  if (opts.certificate) {
    if (!c.acceptance) return new Response("Ce contrat n’est pas encore accepté.", { status: 409, headers: NO_STORE });
    const pdf = await renderCertificatePdf(certificateRows(c), {
      title: "Certificat d’acceptation électronique",
      intro: `Ce certificat récapitule la preuve conservée par le Nomad Club pour le contrat ${c.number}. Pour vérifier le document, calculer l’empreinte SHA-256 du fichier PDF du contrat : elle doit être identique à celle indiquée ci-dessous.`,
      headerRight: `Certificat · contrat n° ${c.number}`,
      footerLeft: `Nomad Club · certificat d’acceptation · ${c.number}`,
      date: c.acceptance.acceptedAt,
    });
    return new Response(Buffer.from(pdf), { headers: { ...NO_STORE, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.number}-certificat.pdf"` } });
  }
  const delivery = await getRepo().contractPdfDelivery(c);
  if (delivery.kind === "url") return Response.redirect(delivery.url, 302);
  try {
    const pdf = await contractPdfBytes(c);
    return new Response(Buffer.from(pdf), {
      headers: { ...NO_STORE, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.number}.pdf"`, "X-Contract-Sha256": c.pdfSha256 },
    });
  } catch (e) {
    console.error("[contrats]", e instanceof Error ? e.message : e);
    return new Response("Le document ne correspond plus à l’empreinte enregistrée. Préviens les fondatrices.", { status: 409, headers: NO_STORE });
  }
}

/** Vérifie l'empreinte du PDF (régénéré) d'un contrat : affichée dans le détail du back-office. */
export async function verifyContractHash(c: Contract): Promise<boolean> {
  try {
    await contractPdfBytes(c);
    return true;
  } catch {
    return false;
  }
}

export { dateLong, formatAmount };
