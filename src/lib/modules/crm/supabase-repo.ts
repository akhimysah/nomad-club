/**
 * CRM en mode réel : tables crm_* (0007_crm.sql), lues et écrites avec la session de l'administratrice
 * (la RLS réserve tout au rôle admin). La synchronisation profils → contacts est faite par le
 * déclencheur crm_sync_profile ; la fusion par la fonction crm_merge_contacts (atomique).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "../../supabase/server";
import type { BulkPatch, ContactInput, CrmRepo, DealInput } from "./repo";
import { sanitizeFilter } from "./domain";
import type { Activity, Contact, Deal, Segment, Stage, Task } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function db(): Promise<SupabaseClient> {
  return supabaseServer();
}

function toContact(r: Row): Contact {
  return {
    id: str(r.id),
    kind: (r.kind as Contact["kind"]) ?? "person",
    profileId: strN(r.profile_id),
    organizationId: strN(r.organization_id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    company: strN(r.company),
    job: strN(r.job),
    email: strN(r.email),
    phone: strN(r.phone),
    instagram: strN(r.instagram),
    city: strN(r.city),
    source: (r.source as Contact["source"]) ?? "autre",
    status: (r.status as Contact["status"]) ?? "prospect",
    tags: (r.tags as string[] | null) ?? [],
    notes: str(r.notes),
    marketingConsent: Boolean(r.marketing_consent),
    consentAt: strN(r.consent_at),
    ownerId: strN(r.owner_id),
    createdBy: strN(r.created_by),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

const toStage = (r: Row): Stage => ({ id: str(r.id), label: str(r.label), position: Number(r.position ?? 0), outcome: (r.outcome as Stage["outcome"]) ?? "open" });

function toDeal(r: Row): Deal {
  return {
    id: str(r.id),
    contactId: str(r.contact_id),
    stageId: str(r.stage_id),
    title: str(r.title),
    value: Number(r.value ?? 0),
    lostReason: strN(r.lost_reason),
    ownerId: strN(r.owner_id),
    position: Number(r.position ?? 0),
    expectedClose: strN(r.expected_close),
    closedAt: strN(r.closed_at),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

const toActivity = (r: Row): Activity => ({
  id: str(r.id),
  contactId: str(r.contact_id),
  type: r.type as Activity["type"],
  body: str(r.body),
  occurredAt: str(r.occurred_at),
  authorId: strN(r.author_id),
  createdAt: str(r.created_at),
});

const toTask = (r: Row): Task => ({
  id: str(r.id),
  contactId: strN(r.contact_id),
  title: str(r.title),
  dueOn: str(r.due_on),
  ownerId: strN(r.owner_id),
  doneAt: strN(r.done_at),
  remindedAt: strN(r.reminded_at),
  createdBy: strN(r.created_by),
  createdAt: str(r.created_at),
});

const toSegment = (r: Row): Segment => ({
  id: str(r.id),
  name: str(r.name),
  description: strN(r.description),
  filters: sanitizeFilter(r.filters),
  createdBy: strN(r.created_by),
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
});

function contactRow(input: Partial<ContactInput>): Row {
  const map: Record<keyof ContactInput, string> = {
    kind: "kind",
    firstName: "first_name",
    lastName: "last_name",
    company: "company",
    job: "job",
    email: "email",
    phone: "phone",
    instagram: "instagram",
    city: "city",
    source: "source",
    status: "status",
    tags: "tags",
    notes: "notes",
    marketingConsent: "marketing_consent",
    ownerId: "owner_id",
    profileId: "profile_id",
  };
  const row: Row = {};
  (Object.keys(input) as Array<keyof ContactInput>).forEach((k) => {
    if (input[k] !== undefined) row[map[k]] = input[k];
  });
  return row;
}

function dealRow(input: DealInput): Row {
  return {
    contact_id: input.contactId,
    stage_id: input.stageId,
    title: input.title,
    value: input.value,
    owner_id: input.ownerId,
    expected_close: input.expectedClose,
    lost_reason: input.lostReason ?? null,
  };
}

async function stageOutcome(c: SupabaseClient, stageId: string): Promise<Stage["outcome"]> {
  const r = check(await c.from("crm_stages").select("outcome").eq("id", stageId).maybeSingle()) as Row | null;
  if (!r) throw new Error("Étape introuvable.");
  return r.outcome as Stage["outcome"];
}

export const crmSupabaseRepo: CrmRepo = {
  async crmData() {
    const c = await db();
    const [contacts, stages, deals, activities, tasks, segments] = await Promise.all([
      c.from("crm_contacts").select("*").limit(20000),
      c.from("crm_stages").select("*").order("position"),
      c.from("crm_deals").select("*").limit(20000),
      c.from("crm_activities").select("*").order("occurred_at", { ascending: false }).limit(20000),
      c.from("crm_tasks").select("*").limit(20000),
      c.from("crm_segments").select("*").order("created_at"),
    ]);
    return {
      contacts: (check(contacts) as Row[]).map(toContact),
      stages: (check(stages) as Row[]).map(toStage),
      deals: (check(deals) as Row[]).map(toDeal),
      activities: (check(activities) as Row[]).map(toActivity),
      tasks: (check(tasks) as Row[]).map(toTask),
      segments: (check(segments) as Row[]).map(toSegment),
    };
  },

  async crmCreateContact(input, actorId) {
    const c = await db();
    const row = { ...contactRow(input), created_by: actorId, consent_at: input.marketingConsent ? new Date().toISOString() : null };
    return toContact(check(await c.from("crm_contacts").insert(row).select("*").single()) as Row);
  },
  async crmUpdateContact(id, input) {
    const c = await db();
    const row = contactRow(input);
    if (input.marketingConsent !== undefined) {
      const cur = check(await c.from("crm_contacts").select("marketing_consent").eq("id", id).maybeSingle()) as Row | null;
      if (!cur) throw new Error("Fiche introuvable.");
      if (Boolean(cur.marketing_consent) !== input.marketingConsent) row.consent_at = input.marketingConsent ? new Date().toISOString() : null;
    }
    return toContact(check(await c.from("crm_contacts").update(row).eq("id", id).select("*").single()) as Row);
  },
  async crmImportContacts(rows, actorId) {
    if (!rows.length) return 0;
    const c = await db();
    const at = new Date().toISOString();
    const res = await c
      .from("crm_contacts")
      .insert(rows.map((r) => ({ ...contactRow({ ...r, profileId: null }), created_by: actorId, consent_at: r.marketingConsent ? at : null })), { count: "exact" });
    if (res.error) throw new Error(res.error.message);
    return res.count ?? rows.length;
  },
  async crmBulkUpdate(ids, patch: BulkPatch) {
    if (!ids.length) return 0;
    const c = await db();
    if (patch.ownerId !== undefined || patch.consent !== undefined) {
      const row: Row = {};
      if (patch.ownerId !== undefined) row.owner_id = patch.ownerId;
      if (patch.consent !== undefined) {
        row.marketing_consent = patch.consent;
        row.consent_at = patch.consent ? new Date().toISOString() : null;
      }
      check(await c.from("crm_contacts").update(row).in("id", ids));
    }
    if (patch.addTag || patch.removeTag) {
      const cur = check(await c.from("crm_contacts").select("id, tags").in("id", ids)) as Row[];
      for (const r of cur) {
        let tags = (r.tags as string[] | null) ?? [];
        if (patch.addTag && !tags.includes(patch.addTag)) tags = [...tags, patch.addTag];
        if (patch.removeTag) tags = tags.filter((t) => t !== patch.removeTag);
        check(await c.from("crm_contacts").update({ tags }).eq("id", str(r.id)));
      }
    }
    return ids.length;
  },
  async crmMergeContacts(keepId, dropId) {
    const c = await db();
    check(await c.rpc("crm_merge_contacts", { p_keep: keepId, p_drop: dropId }));
    return toContact(check(await c.from("crm_contacts").select("*").eq("id", keepId).single()) as Row);
  },

  async crmSaveDeal(input, id) {
    const c = await db();
    const outcome = await stageOutcome(c, input.stageId);
    const row = dealRow(input);
    if (outcome !== "lost") row.lost_reason = null;
    if (id) {
      const cur = check(await c.from("crm_deals").select("stage_id").eq("id", id).maybeSingle()) as Row | null;
      if (!cur) throw new Error("Opportunité introuvable.");
      if (str(cur.stage_id) !== input.stageId) row.closed_at = outcome === "open" ? null : new Date().toISOString();
      return toDeal(check(await c.from("crm_deals").update(row).eq("id", id).select("*").single()) as Row);
    }
    const count = check(await c.from("crm_deals").select("id").eq("stage_id", input.stageId)) as Row[];
    row.position = count.length;
    row.closed_at = outcome === "open" ? null : new Date().toISOString();
    return toDeal(check(await c.from("crm_deals").insert(row).select("*").single()) as Row);
  },
  async crmMoveDeal(id, stageId, position, lostReason) {
    const c = await db();
    const outcome = await stageOutcome(c, stageId);
    const cur = check(await c.from("crm_deals").select("*").eq("id", id).maybeSingle()) as Row | null;
    if (!cur) throw new Error("Opportunité introuvable.");
    const col = (check(await c.from("crm_deals").select("id, position").eq("stage_id", stageId).neq("id", id).order("position")) as Row[]).map((r) => str(r.id));
    col.splice(Math.max(0, Math.min(position, col.length)), 0, id);
    await Promise.all(col.filter((x) => x !== id).map((x) => c.from("crm_deals").update({ position: col.indexOf(x) }).eq("id", x)));
    const changed = str(cur.stage_id) !== stageId;
    const row: Row = { stage_id: stageId, position: col.indexOf(id), lost_reason: outcome === "lost" ? lostReason ?? strN(cur.lost_reason) : null };
    if (changed) row.closed_at = outcome === "open" ? null : new Date().toISOString();
    return toDeal(check(await c.from("crm_deals").update(row).eq("id", id).select("*").single()) as Row);
  },
  async crmSaveStages(input) {
    const c = await db();
    const existing = (check(await c.from("crm_stages").select("id")) as Row[]).map((r) => str(r.id));
    const keep = new Set(input.map((s) => s.id).filter((x): x is string => !!x));
    const removed = existing.filter((x) => !keep.has(x));
    if (removed.length) {
      const used = check(await c.from("crm_deals").select("id").in("stage_id", removed).limit(1)) as Row[];
      if (used.length) throw new Error("Une étape qui contient des opportunités ne peut pas être supprimée.");
      check(await c.from("crm_stages").delete().in("id", removed));
    }
    for (const [i, s] of input.entries()) {
      if (s.id) check(await c.from("crm_stages").update({ label: s.label, outcome: s.outcome, position: i }).eq("id", s.id));
      else check(await c.from("crm_stages").insert({ label: s.label, outcome: s.outcome, position: i }));
    }
    return (check(await c.from("crm_stages").select("*").order("position")) as Row[]).map(toStage);
  },

  async crmAddActivity(input) {
    const c = await db();
    const row = { contact_id: input.contactId, type: input.type, body: input.body, occurred_at: input.occurredAt, author_id: input.authorId };
    return toActivity(check(await c.from("crm_activities").insert(row).select("*").single()) as Row);
  },

  async crmCreateTasks(inputs) {
    if (!inputs.length) return [];
    const c = await db();
    const rows = inputs.map((t) => ({ contact_id: t.contactId, title: t.title, due_on: t.dueOn, owner_id: t.ownerId, created_by: t.createdBy }));
    return (check(await c.from("crm_tasks").insert(rows).select("*")) as Row[]).map(toTask);
  },
  async crmUpdateTask(id, patch) {
    const c = await db();
    const row: Row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.dueOn !== undefined) {
      row.due_on = patch.dueOn;
      row.reminded_at = null;
    }
    if (patch.ownerId !== undefined) {
      row.owner_id = patch.ownerId;
      row.reminded_at = null;
    }
    return toTask(check(await c.from("crm_tasks").update(row).eq("id", id).select("*").single()) as Row);
  },
  async crmSetTaskDone(id, done) {
    const c = await db();
    return toTask(check(await c.from("crm_tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).select("*").single()) as Row);
  },
  async crmMarkTasksReminded(ids) {
    if (!ids.length) return;
    const c = await db();
    check(await c.from("crm_tasks").update({ reminded_at: new Date().toISOString() }).in("id", ids));
  },

  async crmSaveSegment(input, id, actorId) {
    const c = await db();
    const row = { name: input.name, description: input.description, filters: input.filters };
    if (id) return toSegment(check(await c.from("crm_segments").update(row).eq("id", id).select("*").single()) as Row);
    return toSegment(check(await c.from("crm_segments").insert({ ...row, created_by: actorId }).select("*").single()) as Row);
  },
  async crmDeleteSegment(id) {
    const c = await db();
    check(await c.from("crm_segments").delete().eq("id", id));
  },
};
