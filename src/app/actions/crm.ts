"use server";

/**
 * Actions du CRM (Lot 5). Toutes exigent la capacité crm.access (administratrices) ;
 * les opérations importantes sont journalisées (audit) ; aucun message n'est envoyé automatiquement.
 */
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { checkCapability } from "@/lib/auth";
import { today, zonedIso } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { notify } from "@/lib/notify";
import { contactName, existingMatch, normalizeTag, sanitizeFilter } from "@/lib/modules/crm/domain";
import { loadCrm } from "@/lib/modules/crm/load";
import type { BulkPatch, ContactInput, TaskInput } from "@/lib/modules/crm/repo";
import type { ContactFilter, StageOutcome } from "@/lib/modules/crm/types";
import { activitySchema, contactSchema, dealSchema, segmentSchema, stagesSchema, taskSchema, type ContactForm } from "@/lib/modules/crm/validation";

export type CrmResult = { ok: true; message: string; id?: string } | { ok: false; error: string; field?: string };

async function admin() {
  return (await checkCapability("crm.access"))?.profile ?? null;
}

const DENIED: CrmResult = { ok: false, error: "Réservé aux fondatrices." };

function refresh() {
  revalidatePath("/fondatrices/crm", "layout");
}

function fail(e: unknown, fallback: string): CrmResult {
  return { ok: false, error: e instanceof Error && e.message ? e.message : fallback };
}

async function validOwner(id: string | null): Promise<string | null> {
  if (!id) return null;
  const { owners } = await loadCrm();
  return owners.some((o) => o.id === id) ? id : null;
}

/* ---------- contacts ---------- */

export async function saveContactAction(form: ContactForm, id: string | null): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const parsed = contactSchema.safeParse(form);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const input: ContactInput = { ...parsed.data, ownerId: await validOwner(parsed.data.ownerId) };
  const repo = getRepo();
  try {
    if (id) {
      const c = await repo.crmUpdateContact(id, input);
      await audit({ actorId: me.id, action: "crm.contact_update", targetType: "crm_contact", targetId: c.id, summary: `Fiche de ${contactName(c)} modifiée`, details: {} });
      refresh();
      return { ok: true, message: "Fiche enregistrée", id: c.id };
    }
    const c = await repo.crmCreateContact(input, me.id);
    await audit({ actorId: me.id, action: "crm.contact_create", targetType: "crm_contact", targetId: c.id, summary: `Contact ${contactName(c)} créé`, details: { source: c.source, status: c.status } });
    refresh();
    return { ok: true, message: `${contactName(c)} est dans le CRM`, id: c.id };
  } catch (e) {
    return fail(e, "Enregistrement impossible.");
  }
}

export async function mergeContactsAction(keepId: string, dropId: string): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const { rowById } = await loadCrm();
  const keep = rowById.get(keepId);
  const drop = rowById.get(dropId);
  if (!keep || !drop) return { ok: false, error: "Fiche introuvable." };
  try {
    const c = await getRepo().crmMergeContacts(keepId, dropId, me.id);
    await audit({
      actorId: me.id,
      action: "crm.contact_merge",
      targetType: "crm_contact",
      targetId: c.id,
      summary: `Fiches fusionnées : « ${drop.name} » versée dans « ${keep.name} »`,
      details: { kept: keepId, dropped: dropId, droppedEmail: drop.email },
    });
    refresh();
    return { ok: true, message: "Fiches fusionnées", id: c.id };
  } catch (e) {
    return fail(e, "Fusion impossible.");
  }
}

export type ImportRow = Partial<Record<"firstName" | "lastName" | "company" | "job" | "email" | "phone" | "instagram" | "city" | "notes" | "tags" | "source" | "status" | "consent", string>>;

const SOURCE_WORDS: Array<[RegExp, ContactInput["source"]]> = [
  [/insta/i, "instagram"],
  [/bouche|recommand|ami/i, "bouche_a_oreille"],
  [/(é|e)v(é|e)nement|event|soir(é|e)e|lunch/i, "evenement"],
  [/site|web|formulaire/i, "site"],
  [/parrain/i, "parrainage"],
  [/partenaire/i, "partenaire"],
  [/presse|journal|m(é|e)dia/i, "presse"],
  [/linkedin/i, "linkedin"],
];
const STATUS_WORDS: Array<[RegExp, ContactInput["status"]]> = [
  [/ancien/i, "ancienne"],
  [/adh(é|e)rent|membre/i, "adherente"],
  [/partenaire/i, "partenaire"],
  [/\bpro\b|professionnel/i, "pro"],
  [/presse|journal/i, "presse"],
  [/prospect|lead/i, "prospect"],
];

/**
 * Import CSV (après aperçu et correspondance des colonnes côté client).
 * Les lignes sans nom sont ignorées ; celles qui ressemblent à une fiche existante (même e-mail ou téléphone)
 * sont écartées, sauf si `allowDuplicates`.
 */
export async function importContactsAction(rows: ImportRow[], opts: { tag?: string; ownerId?: string | null; allowDuplicates?: boolean } = {}): Promise<CrmResult & { created?: number; skipped?: number }> {
  const me = await admin();
  if (!me) return DENIED;
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Aucune ligne à importer." };
  if (rows.length > 2000) return { ok: false, error: "2 000 lignes au plus par import." };
  const { rows: existing } = await loadCrm();
  const tag = opts.tag ? normalizeTag(opts.tag) : "";
  const ownerId = await validOwner(opts.ownerId ?? null);
  const seen: Array<{ email: string | null; phone: string | null }> = [];
  const valid: ContactInput[] = [];
  let skipped = 0;
  for (const r of rows) {
    const src = (r.source ?? "").trim();
    const st = (r.status ?? "").trim();
    const parsed = contactSchema.safeParse({
      firstName: r.firstName ?? "",
      lastName: r.lastName ?? "",
      company: r.company ?? "",
      job: r.job ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      instagram: r.instagram ?? "",
      city: r.city ?? "",
      notes: r.notes ?? "",
      tags: [...(r.tags ?? "").split(/[,;|]/), tag].filter(Boolean),
      source: SOURCE_WORDS.find(([re]) => re.test(src))?.[1] ?? "import",
      status: STATUS_WORDS.find(([re]) => re.test(st))?.[1] ?? "prospect",
      marketingConsent: /^(oui|yes|1|true|vrai|x)$/i.test((r.consent ?? "").trim()),
      kind: !r.firstName && !r.lastName && r.company ? "organization" : "person",
      ownerId,
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    const c = parsed.data;
    const dupInFile = seen.some((s) => (c.email && s.email === c.email.toLowerCase()) || (c.phone && s.phone === c.phone.replace(/\D/g, "")));
    if (!opts.allowDuplicates && (dupInFile || existingMatch(existing, c.email, c.phone))) {
      skipped++;
      continue;
    }
    seen.push({ email: c.email?.toLowerCase() ?? null, phone: c.phone?.replace(/\D/g, "") ?? null });
    valid.push({ ...c, ownerId });
  }
  if (!valid.length) return { ok: false, error: `Rien à importer : ${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""} (sans nom, invalides ou déjà présentes).` };
  try {
    const n = await getRepo().crmImportContacts(valid, me.id);
    await audit({ actorId: me.id, action: "crm.contact_import", targetType: "crm_contact", targetId: null, summary: `Import CSV : ${n} contact${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`, details: { created: n, skipped, tag: tag || null } });
    refresh();
    return { ok: true, message: `${n} contact${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}${skipped ? ` · ${skipped} ignoré${skipped > 1 ? "s" : ""}` : ""}`, created: n, skipped };
  } catch (e) {
    return fail(e, "Import impossible.");
  }
}

/* ---------- actions groupées ---------- */

export type BulkInput =
  | { kind: "tag"; ids: string[]; tag: string }
  | { kind: "untag"; ids: string[]; tag: string }
  | { kind: "owner"; ids: string[]; ownerId: string | null }
  | { kind: "consent"; ids: string[]; consent: boolean }
  | { kind: "task"; ids: string[]; title: string; dueOn: string; ownerId: string | null };

export async function bulkAction(input: BulkInput): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const { rowById, owners } = await loadCrm();
  const ids = [...new Set(input.ids)].filter((id) => rowById.has(id)).slice(0, 2000);
  if (!ids.length) return { ok: false, error: "Sélectionnez au moins un contact." };
  const repo = getRepo();
  const n = ids.length;
  const plural = n > 1 ? "s" : "";
  try {
    if (input.kind === "task") {
      const t = taskSchema.safeParse({ contactId: null, title: input.title, dueOn: input.dueOn, ownerId: input.ownerId });
      if (!t.success) return { ok: false, error: t.error.issues[0].message };
      const ownerId = (await validOwner(t.data.ownerId)) ?? me.id;
      const tasks: TaskInput[] = ids.map((id) => ({ contactId: id, title: t.data.title, dueOn: t.data.dueOn, ownerId, createdBy: me.id }));
      await repo.crmCreateTasks(tasks);
      await audit({ actorId: me.id, action: "crm.task_create", targetType: "crm_task", targetId: null, summary: `${n} tâche${plural} « ${t.data.title} » créée${plural}`, details: { contacts: n, dueOn: t.data.dueOn, ownerId } });
      if (ownerId !== me.id) await taskAssigned(ownerId, me.firstName, `${n} tâche${plural} « ${t.data.title} »`);
      refresh();
      return { ok: true, message: `${n} tâche${plural} créée${plural}` };
    }
    let patch: BulkPatch;
    let summary: string;
    if (input.kind === "tag" || input.kind === "untag") {
      const tag = normalizeTag(input.tag);
      if (!tag) return { ok: false, error: "Indiquez une étiquette." };
      patch = input.kind === "tag" ? { addTag: tag } : { removeTag: tag };
      summary = `${input.kind === "tag" ? "Étiquette ajoutée" : "Étiquette retirée"} : #${tag} (${n} contact${plural})`;
    } else if (input.kind === "owner") {
      const ownerId = await validOwner(input.ownerId);
      patch = { ownerId };
      summary = `${n} contact${plural} confié${plural} à ${owners.find((o) => o.id === ownerId)?.first ?? "personne"}`;
    } else {
      patch = { consent: input.consent };
      summary = `Consentement ${input.consent ? "enregistré" : "retiré"} (${n} contact${plural})`;
    }
    await repo.crmBulkUpdate(ids, patch);
    await audit({ actorId: me.id, action: "crm.bulk_update", targetType: "crm_contact", targetId: null, summary, details: { kind: input.kind, contacts: n } });
    refresh();
    return { ok: true, message: summary };
  } catch (e) {
    return fail(e, "Action impossible.");
  }
}

/* ---------- activités et tâches ---------- */

export async function addActivityAction(input: { contactId: string; type: string; body: string; occurredOn?: string }): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const t = today();
  const occurredAt = d.occurredOn && d.occurredOn !== t ? zonedIso(d.occurredOn, "12:00") : new Date().toISOString();
  try {
    await getRepo().crmAddActivity({ contactId: d.contactId, type: d.type, body: d.body, occurredAt, authorId: me.id });
    refresh();
    return { ok: true, message: "Échange ajouté à l’historique" };
  } catch (e) {
    return fail(e, "Enregistrement impossible.");
  }
}

async function taskAssigned(ownerId: string, byFirst: string, what: string) {
  await notify([{ recipientId: ownerId, type: "crm_task_due", title: `${byFirst} t’a confié ${what}`, body: "Retrouve-la dans tes tâches du CRM.", link: "/fondatrices/crm/taches" }]);
}

export async function createTaskAction(input: { contactId: string | null; title: string; dueOn: string; ownerId: string | null }): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { rowById } = await loadCrm();
  const contactId = parsed.data.contactId && rowById.has(parsed.data.contactId) ? parsed.data.contactId : null;
  const ownerId = (await validOwner(parsed.data.ownerId)) ?? me.id;
  try {
    const [task] = await getRepo().crmCreateTasks([{ contactId, title: parsed.data.title, dueOn: parsed.data.dueOn, ownerId, createdBy: me.id }]);
    await audit({ actorId: me.id, action: "crm.task_create", targetType: "crm_task", targetId: task.id, summary: `Tâche « ${task.title} »${contactId ? ` · ${rowById.get(contactId)?.name}` : ""}`, details: { dueOn: task.dueOn, ownerId } });
    if (ownerId !== me.id) await taskAssigned(ownerId, me.firstName, `la tâche « ${task.title} »`);
    refresh();
    return { ok: true, message: "Tâche créée", id: task.id };
  } catch (e) {
    return fail(e, "Création impossible.");
  }
}

export async function toggleTaskAction(id: string, done: boolean): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  try {
    const t = await getRepo().crmSetTaskDone(id, done);
    refresh();
    return { ok: true, message: done ? `« ${t.title} » faite` : `« ${t.title} » rouverte` };
  } catch (e) {
    return fail(e, "Mise à jour impossible.");
  }
}

export async function rescheduleTaskAction(id: string, dueOn: string): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: "Date invalide." };
  try {
    await getRepo().crmUpdateTask(id, { dueOn });
    refresh();
    return { ok: true, message: "Échéance déplacée" };
  } catch (e) {
    return fail(e, "Mise à jour impossible.");
  }
}

/* ---------- pipeline ---------- */

export async function saveDealAction(input: { contactId: string; stageId: string; title: string; value: number; ownerId: string | null; expectedClose: string | null; lostReason?: string | null }, id: string | null): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { data, rowById } = await loadCrm();
  const stage = data.stages.find((s) => s.id === parsed.data.stageId);
  if (!stage || !rowById.has(parsed.data.contactId)) return { ok: false, error: "Étape ou contact introuvable." };
  if (stage.outcome === "lost" && !parsed.data.lostReason) return { ok: false, error: "Indiquez le motif de perte.", field: "lostReason" };
  try {
    const d = await getRepo().crmSaveDeal({ ...parsed.data, ownerId: await validOwner(parsed.data.ownerId) }, id);
    await audit({ actorId: me.id, action: "crm.deal_save", targetType: "crm_deal", targetId: d.id, summary: `Opportunité « ${d.title} » · ${rowById.get(d.contactId)?.name} (${stage.label})`, details: { stage: stage.label, value: d.value } });
    refresh();
    return { ok: true, message: id ? "Opportunité enregistrée" : "Ajoutée au pipeline", id: d.id };
  } catch (e) {
    return fail(e, "Enregistrement impossible.");
  }
}

export async function moveDealAction(id: string, stageId: string, position: number, lostReason: string | null = null): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const { data, rowById } = await loadCrm();
  const deal = data.deals.find((d) => d.id === id);
  const stage = data.stages.find((s) => s.id === stageId);
  if (!deal || !stage) return { ok: false, error: "Opportunité ou étape introuvable." };
  const reason = lostReason?.trim().slice(0, 300) || null;
  if (stage.outcome === "lost" && !reason && !deal.lostReason) return { ok: false, error: "Indiquez le motif de perte." };
  try {
    const d = await getRepo().crmMoveDeal(id, stageId, Math.max(0, Math.floor(position) || 0), reason);
    if (deal.stageId !== stageId) {
      const name = rowById.get(d.contactId)?.name ?? "";
      await audit({ actorId: me.id, action: "crm.deal_move", targetType: "crm_deal", targetId: d.id, summary: `${name} → ${stage.label}`, details: { from: deal.stageId, to: stageId, lostReason: reason } });
      await getRepo().crmAddActivity({ contactId: d.contactId, type: "system", body: `Pipeline : « ${stage.label} »${reason ? ` (motif : ${reason})` : ""}`, occurredAt: new Date().toISOString(), authorId: me.id });
    }
    refresh();
    return { ok: true, message: `Déplacée vers « ${stage.label} »` };
  } catch (e) {
    return fail(e, "Déplacement impossible.");
  }
}

export async function saveStagesAction(stages: Array<{ id: string | null; label: string; outcome: StageOutcome }>): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const parsed = stagesSchema.safeParse(stages);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const out = await getRepo().crmSaveStages(parsed.data);
    await audit({ actorId: me.id, action: "crm.stages_update", targetType: "crm_deal", targetId: null, summary: `Étapes du pipeline : ${out.map((s) => s.label).join(" → ")}`, details: {} });
    refresh();
    return { ok: true, message: "Étapes enregistrées" };
  } catch (e) {
    return fail(e, "Enregistrement impossible.");
  }
}

/* ---------- segments ---------- */

export async function saveSegmentAction(input: { name: string; description?: string | null; filters: ContactFilter }, id: string | null): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const parsed = segmentSchema.safeParse({ name: input.name, description: input.description ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const filters = sanitizeFilter(input.filters);
  try {
    const s = await getRepo().crmSaveSegment({ ...parsed.data, filters }, id, me.id);
    await audit({ actorId: me.id, action: "crm.segment_save", targetType: "crm_segment", targetId: s.id, summary: `Segment « ${s.name} » enregistré par ${fullName(me)}`, details: { filters } });
    refresh();
    return { ok: true, message: `Segment « ${s.name} » enregistré`, id: s.id };
  } catch (e) {
    return fail(e, "Enregistrement impossible.");
  }
}

export async function deleteSegmentAction(id: string): Promise<CrmResult> {
  const me = await admin();
  if (!me) return DENIED;
  const { data } = await loadCrm();
  const s = data.segments.find((x) => x.id === id);
  if (!s) return { ok: false, error: "Segment introuvable." };
  await getRepo().crmDeleteSegment(id);
  await audit({ actorId: me.id, action: "crm.segment_delete", targetType: "crm_segment", targetId: id, summary: `Segment « ${s.name} » supprimé`, details: { filters: s.filters } });
  refresh();
  return { ok: true, message: "Segment supprimé" };
}
