/**
 * Vague 2 · Contrats — implémentation Supabase du ContratsRepo.
 * Lectures avec la session de la personne (RLS de 0010 : la signataire, la propriétaire de l'établissement,
 * les administratrices). Écritures de contrats, dépôt des PDF et journal : clé service quand elle est
 * configurée (génération depuis un webhook de paiement, sans session), sinon session (administratrice).
 * L'acceptation passe toujours par la fonction SQL accept_contract() avec la session de la signataire.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "../../supabase/server";
import type { ContratsRepo } from "./repo";
import type { Contract, ContractAcceptance, ContractKind, ContractTemplate, ContractView, ScheduleItem } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));
const BUCKET = "contrats";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const db = (): Promise<SupabaseClient> => supabaseServer();
/** Clé service si disponible (opérations déjà vérifiées par l'appli), sinon la session. */
async function writer(): Promise<SupabaseClient> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseAdmin();
  return supabaseServer();
}

function toTemplate(r: Row): ContractTemplate {
  return {
    id: str(r.id),
    kind: r.kind as ContractKind,
    version: Number(r.version),
    title: str(r.title),
    bodyMd: str(r.body_md),
    effectiveFrom: str(r.effective_from).slice(0, 10),
    active: Boolean(r.is_active),
    notes: strN(r.notes),
    createdBy: strN(r.created_by),
    createdAt: str(r.created_at),
    activatedAt: strN(r.activated_at),
  };
}

function toContract(r: Row): Contract {
  return {
    id: str(r.id),
    number: str(r.number),
    kind: r.kind as ContractKind,
    templateId: str(r.template_id),
    templateVersion: Number(r.template_version),
    profileId: strN(r.profile_id),
    organizationId: strN(r.organization_id),
    plan: str(r.plan),
    amount: Number(r.amount),
    currency: str(r.currency),
    installments: Number(r.installments),
    schedule: (Array.isArray(r.schedule) ? r.schedule : []) as ScheduleItem[],
    startsOn: str(r.starts_on).slice(0, 10),
    endsOn: r.ends_on ? str(r.ends_on).slice(0, 10) : null,
    variables: (r.variables as Record<string, string>) ?? {},
    bodyMd: str(r.body_md),
    pdfSha256: str(r.pdf_sha256),
    pdfPath: strN(r.pdf_path),
    status: r.status as Contract["status"],
    subscriptionRef: strN(r.subscription_ref),
    source: r.source as Contract["source"],
    createdBy: strN(r.created_by),
    createdAt: str(r.created_at),
    acceptedAt: strN(r.accepted_at),
    cancelledAt: strN(r.cancelled_at),
    cancelReason: strN(r.cancel_reason),
    remindedAt: strN(r.reminded_at),
    reminderCount: Number(r.reminder_count ?? 0),
  };
}

function toAcceptance(r: Row): ContractAcceptance {
  return {
    id: str(r.id),
    contractId: str(r.contract_id),
    profileId: strN(r.profile_id),
    signerName: str(r.signer_name),
    signerEmail: strN(r.signer_email),
    acceptedAt: str(r.accepted_at),
    ip: strN(r.ip),
    userAgent: strN(r.user_agent),
    templateVersion: Number(r.template_version),
    pdfSha256: str(r.pdf_sha256),
    provider: str(r.provider),
    providerRef: strN(r.provider_ref),
    method: str(r.method),
    statement: str(r.statement),
  };
}

const one = <T>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null));

const VIEW_SELECT = "*, contract_acceptances(*), signer:profiles!contracts_profile_id_fkey(first_name, last_name), organization:organizations(name), template:contract_templates(title)";

function toView(r: Row): ContractView {
  const c = toContract(r);
  const acc = one<Row>(r.contract_acceptances);
  const p = one<Row>(r.signer);
  const o = one<Row>(r.organization);
  const t = one<Row>(r.template);
  const name = p ? `${str(p.first_name)} ${str(p.last_name)}`.trim() : "";
  return {
    ...c,
    acceptance: acc ? toAcceptance(acc) : null,
    signerName: name || acc?.signer_name?.toString() || c.variables["signataire.nom"] || "—",
    organizationName: o ? str(o.name) : c.organizationId ? (c.variables["etablissement.nom"] ?? null) : null,
    templateTitle: t ? str(t.title) : "Modèle",
  };
}

export const supabaseContratsRepo: ContratsRepo = {
  async listContractTemplates(kind) {
    let q = (await db()).from("contract_templates").select("*").order("kind").order("version", { ascending: false });
    if (kind) q = q.eq("kind", kind);
    return (check(await q) as Row[]).map(toTemplate);
  },
  async getContractTemplate(id) {
    const r = check(await (await db()).from("contract_templates").select("*").eq("id", id).maybeSingle()) as Row | null;
    return r ? toTemplate(r) : null;
  },
  async getActiveContractTemplate(kind) {
    const r = check(await (await writer()).from("contract_templates").select("*").eq("kind", kind).eq("is_active", true).maybeSingle()) as Row | null;
    return r ? toTemplate(r) : null;
  },
  async createContractTemplate(input, actorId) {
    const c = await db();
    const last = check(await c.from("contract_templates").select("version").eq("kind", input.kind).order("version", { ascending: false }).limit(1)) as Row[];
    const version = (last[0] ? Number(last[0].version) : 0) + 1;
    const r = check(
      await c
        .from("contract_templates")
        .insert({ kind: input.kind, version, title: input.title, body_md: input.bodyMd, effective_from: input.effectiveFrom, notes: input.notes, created_by: actorId, is_active: false })
        .select("*")
        .single(),
    ) as Row;
    return toTemplate(r);
  },
  async activateContractTemplate(id) {
    const r = check(await (await db()).rpc("activate_contract_template", { p_id: id })) as Row | null;
    return r ? toTemplate(r) : null;
  },

  async listContracts(f = {}) {
    let q = (await db()).from("contracts").select(VIEW_SELECT).order("created_at", { ascending: false }).limit(500);
    if (f.kind) q = q.eq("kind", f.kind);
    if (f.status) q = q.eq("status", f.status);
    if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
    if (f.to) q = q.lte("created_at", `${f.to}T23:59:59Z`);
    if (f.profileId) q = q.eq("profile_id", f.profileId);
    if (f.organizationId) q = q.eq("organization_id", f.organizationId);
    return (check(await q) as Row[]).map(toView);
  },
  async listMyContracts(profileId) {
    const c = await db();
    const owned = (check(await c.from("organization_members").select("organization_id").eq("profile_id", profileId).eq("role", "owner")) as Row[]).map((r) => str(r.organization_id));
    let q = c.from("contracts").select(VIEW_SELECT).order("created_at", { ascending: false });
    q = owned.length ? q.or(`profile_id.eq.${profileId},organization_id.in.(${owned.join(",")})`) : q.eq("profile_id", profileId);
    return (check(await q) as Row[]).map(toView);
  },
  async getContract(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = check(await (await db()).from("contracts").select(VIEW_SELECT).eq("id", id).maybeSingle()) as Row | null;
    return r ? toView(r) : null;
  },
  async findOpenContract(q) {
    let s = (await writer())
      .from("contracts")
      .select("*")
      .neq("status", "cancelled")
      .eq("profile_id", q.profileId)
      .eq("kind", q.kind)
      .eq("plan", q.plan)
      .gte("created_at", q.sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);
    s = q.organizationId ? s.eq("organization_id", q.organizationId) : s.is("organization_id", null);
    const rows = check(await s) as Row[];
    return rows[0] ? toContract(rows[0]) : null;
  },
  async insertContract(row) {
    const r = check(
      await (await writer())
        .from("contracts")
        .insert({
          ...(row.id ? { id: row.id } : {}),
          number: row.number,
          kind: row.kind,
          template_id: row.templateId,
          template_version: row.templateVersion,
          profile_id: row.profileId,
          organization_id: row.organizationId,
          plan: row.plan,
          amount: row.amount,
          currency: row.currency,
          installments: row.installments,
          schedule: row.schedule,
          starts_on: row.startsOn,
          ends_on: row.endsOn,
          variables: row.variables,
          body_md: row.bodyMd,
          pdf_sha256: row.pdfSha256,
          pdf_path: row.pdfPath,
          subscription_ref: row.subscriptionRef,
          source: row.source,
          created_by: row.createdBy,
          ...(row.createdAt ? { created_at: row.createdAt } : {}),
        })
        .select("*")
        .single(),
    ) as Row;
    return toContract(r);
  },
  async acceptContract(input) {
    const r = check(
      await (await db()).rpc("accept_contract", {
        p_contract: input.contractId,
        p_pdf_sha256: input.pdfSha256,
        p_ip: input.ip,
        p_user_agent: input.userAgent,
        p_statement: input.statement,
        p_provider: input.provider,
        p_provider_ref: input.providerRef,
      }),
    ) as Row;
    return toAcceptance(r);
  },
  async linkContractSubscription(contractId, reference) {
    check(await (await writer()).from("contracts").update({ subscription_ref: reference.slice(0, 120) }).eq("id", contractId).is("subscription_ref", null));
  },
  async cancelContract(contractId, reason) {
    check(await (await db()).from("contracts").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason.slice(0, 500) }).eq("id", contractId).neq("status", "cancelled"));
  },
  async markContractReminded(contractId) {
    const c = await db();
    const cur = check(await c.from("contracts").select("reminder_count").eq("id", contractId).maybeSingle()) as Row | null;
    check(await c.from("contracts").update({ reminded_at: new Date().toISOString(), reminder_count: Number(cur?.reminder_count ?? 0) + 1 }).eq("id", contractId));
  },
  async storeContractPdf(contract, pdf) {
    try {
      const w = await writer();
      const path = `${contract.kind}/${contract.number}.pdf`;
      const up = await w.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message);
      check(await w.from("contracts").update({ pdf_path: path }).eq("id", contract.id).is("pdf_path", null));
      return path;
    } catch (e) {
      console.error("[contrats] dépôt du PDF impossible", e instanceof Error ? e.message : e);
      return null;
    }
  },
  async contractPdfDelivery(contract) {
    if (!contract.pdfPath) return { kind: "regenerate" };
    const r = await (await db()).storage.from(BUCKET).createSignedUrl(contract.pdfPath, 60, { download: `${contract.number}.pdf` });
    if (r.error || !r.data?.signedUrl) return { kind: "regenerate" };
    return { kind: "url", url: r.data.signedUrl };
  },
  async contractParties(profileId, organizationId) {
    const w = await writer();
    const p = check(await w.from("profiles").select("first_name, last_name, email, whatsapp, card_number").eq("id", profileId).maybeSingle()) as Row | null;
    const o = organizationId ? (check(await w.from("organizations").select("name, address, area, category").eq("id", organizationId).maybeSingle()) as Row | null) : null;
    return {
      signer: p
        ? { name: `${str(p.first_name)} ${str(p.last_name)}`.trim() || str(p.first_name), firstName: str(p.first_name), email: strN(p.email), phone: strN(p.whatsapp), card: strN(p.card_number) }
        : null,
      organization: o ? { name: str(o.name), address: [strN(o.address), strN(o.area)].filter(Boolean).join(", ") || null, category: strN(o.category) } : null,
    };
  },
  async logContractAudit(entry) {
    check(
      await (await writer())
        .from("audit_log")
        .insert({ actor_id: entry.actorId, action: entry.action, target_type: entry.targetType, target_id: entry.targetId, summary: entry.summary, details: entry.details ?? {} }),
    );
  },
};
