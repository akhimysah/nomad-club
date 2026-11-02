/**
 * CRM en mode démo : données en mémoire (processus serveur), initialisées depuis ./seed.ts.
 * Les profils viennent du dépôt démo principal : chaque nouveau profil reçoit sa fiche au prochain chargement.
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../../clock";
import type { Profile } from "../../types";
import type { CrmRepo } from "./repo";
import { createCrmSeed } from "./seed";
import { missingProfileContacts } from "./sync";
import type { Contact, CrmData, Deal, Stage, Task } from "./types";

type G = typeof globalThis & { __nomadCrmDb?: CrmData };

const clone = <T>(v: T): T => structuredClone(v);

async function profiles(): Promise<Profile[]> {
  // import tardif : src/lib/data/demo-repo.ts importe ce module (pas de cycle à l'évaluation)
  const { demoRepo } = await import("../../data/demo-repo");
  return demoRepo.listProfiles();
}

async function db(): Promise<CrmData> {
  const g = globalThis as G;
  if (!g.__nomadCrmDb) {
    const { demoRepo } = await import("../../data/demo-repo");
    g.__nomadCrmDb = createCrmSeed({ profiles: await demoRepo.listProfiles(), organizations: await demoRepo.listOrganizations() });
  }
  return g.__nomadCrmDb;
}

function find<T extends { id: string }>(list: T[], id: string, what: string): T {
  const x = list.find((i) => i.id === id);
  if (!x) throw new Error(`${what} introuvable.`);
  return x;
}

export const crmDemoRepo: CrmRepo = {
  async crmData() {
    const d = await db();
    d.contacts.push(...missingProfileContacts(d.contacts, await profiles()));
    return clone(d);
  },

  async crmCreateContact(input, actorId) {
    const d = await db();
    if (input.profileId && d.contacts.some((c) => c.profileId === input.profileId)) throw new Error("Ce compte a déjà sa fiche.");
    const at = nowIso();
    const c: Contact = {
      id: randomUUID(),
      organizationId: null,
      ...input,
      profileId: input.profileId ?? null,
      consentAt: input.marketingConsent ? at : null,
      createdBy: actorId,
      createdAt: at,
      updatedAt: at,
    };
    d.contacts.push(c);
    return clone(c);
  },
  async crmUpdateContact(id, input) {
    const d = await db();
    const c = find(d.contacts, id, "Fiche");
    if (input.marketingConsent !== undefined && input.marketingConsent !== c.marketingConsent) c.consentAt = input.marketingConsent ? nowIso() : null;
    const { profileId, ...rest } = input;
    if (profileId !== undefined) {
      if (profileId && d.contacts.some((x) => x.profileId === profileId && x.id !== id)) throw new Error("Ce compte a déjà sa fiche.");
      c.profileId = profileId;
    }
    Object.assign(c, rest, { updatedAt: nowIso() });
    return clone(c);
  },
  async crmImportContacts(rows, actorId) {
    for (const r of rows) await crmDemoRepo.crmCreateContact({ ...r, profileId: null }, actorId);
    return rows.length;
  },
  async crmBulkUpdate(ids, patch) {
    const d = await db();
    let n = 0;
    for (const c of d.contacts.filter((x) => ids.includes(x.id))) {
      if (patch.addTag && !c.tags.includes(patch.addTag)) c.tags = [...c.tags, patch.addTag];
      if (patch.removeTag) c.tags = c.tags.filter((t) => t !== patch.removeTag);
      if (patch.ownerId !== undefined) c.ownerId = patch.ownerId;
      if (patch.consent !== undefined && patch.consent !== c.marketingConsent) {
        c.marketingConsent = patch.consent;
        c.consentAt = patch.consent ? nowIso() : null;
      }
      c.updatedAt = nowIso();
      n++;
    }
    return n;
  },
  async crmMergeContacts(keepId, dropId, actorId) {
    const d = await db();
    if (keepId === dropId) throw new Error("Choisissez deux fiches différentes.");
    const k = find(d.contacts, keepId, "Fiche");
    const x = find(d.contacts, dropId, "Fiche");
    if (k.profileId && x.profileId) throw new Error("Les deux fiches sont reliées à deux comptes différents : fusion impossible.");
    d.activities.forEach((a) => a.contactId === dropId && (a.contactId = keepId));
    d.tasks.forEach((t) => t.contactId === dropId && (t.contactId = keepId));
    d.deals.forEach((dl) => dl.contactId === dropId && (dl.contactId = keepId));
    const pick = <K extends keyof Contact>(key: K) => (k[key] === null || k[key] === "" ? x[key] : k[key]);
    Object.assign(k, {
      profileId: k.profileId ?? x.profileId,
      organizationId: k.organizationId ?? x.organizationId,
      firstName: pick("firstName"),
      lastName: pick("lastName"),
      company: pick("company"),
      job: pick("job"),
      email: pick("email"),
      phone: pick("phone"),
      instagram: pick("instagram"),
      city: pick("city"),
      source: ["autre", "import", "appli"].includes(k.source) ? x.source : k.source,
      tags: [...new Set([...k.tags, ...x.tags])].sort(),
      notes: [k.notes, x.notes].filter(Boolean).join("\n\n").slice(0, 8000),
      marketingConsent: k.marketingConsent || x.marketingConsent,
      consentAt: k.consentAt ?? x.consentAt,
      ownerId: k.ownerId ?? x.ownerId,
      createdAt: k.createdAt < x.createdAt ? k.createdAt : x.createdAt,
      updatedAt: nowIso(),
    });
    d.contacts = d.contacts.filter((c) => c.id !== dropId);
    const label = [x.firstName, x.lastName].filter(Boolean).join(" ") + (x.company ? ` · ${x.company}` : "");
    d.activities.push({ id: randomUUID(), contactId: keepId, type: "system", body: `Fiche fusionnée avec « ${label.trim()} »`, occurredAt: nowIso(), authorId: actorId, createdAt: nowIso() });
    return clone(k);
  },

  async crmSaveDeal(input, id) {
    const d = await db();
    const stage = find(d.stages, input.stageId, "Étape");
    const closedAt = stage.outcome === "open" ? null : nowIso();
    if (id) {
      const deal = find(d.deals, id, "Opportunité");
      const moved = deal.stageId !== input.stageId;
      Object.assign(deal, { ...input, lostReason: stage.outcome === "lost" ? input.lostReason ?? deal.lostReason : null, updatedAt: nowIso() });
      if (moved) deal.closedAt = closedAt;
      return clone(deal);
    }
    const deal: Deal = {
      id: randomUUID(),
      ...input,
      lostReason: stage.outcome === "lost" ? input.lostReason ?? null : null,
      position: d.deals.filter((x) => x.stageId === input.stageId).length,
      closedAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.deals.push(deal);
    return clone(deal);
  },
  async crmMoveDeal(id, stageId, position, lostReason) {
    const d = await db();
    const deal = find(d.deals, id, "Opportunité");
    const stage = find(d.stages, stageId, "Étape");
    const changed = deal.stageId !== stageId;
    // renumérote la colonne d'arrivée
    const col = d.deals.filter((x) => x.stageId === stageId && x.id !== id).sort((a, b) => a.position - b.position);
    col.splice(Math.max(0, Math.min(position, col.length)), 0, deal);
    col.forEach((x, i) => (x.position = i));
    deal.stageId = stageId;
    if (changed) deal.closedAt = stage.outcome === "open" ? null : nowIso();
    deal.lostReason = stage.outcome === "lost" ? lostReason ?? deal.lostReason : null;
    deal.updatedAt = nowIso();
    return clone(deal);
  },
  async crmSaveStages(input) {
    const d = await db();
    const keep = new Set(input.map((s) => s.id).filter(Boolean));
    const removed = d.stages.filter((s) => !keep.has(s.id));
    if (removed.some((s) => d.deals.some((x) => x.stageId === s.id))) throw new Error("Une étape qui contient des opportunités ne peut pas être supprimée.");
    d.stages = input.map((s, i): Stage => ({ id: s.id ?? randomUUID(), label: s.label, outcome: s.outcome, position: i }));
    return clone(d.stages);
  },

  async crmAddActivity(input) {
    const d = await db();
    find(d.contacts, input.contactId, "Fiche");
    const a = { id: randomUUID(), ...input, createdAt: nowIso() };
    d.activities.push(a);
    return clone(a);
  },

  async crmCreateTasks(inputs) {
    const d = await db();
    const created: Task[] = inputs.map((t) => ({ id: randomUUID(), ...t, doneAt: null, remindedAt: null, createdAt: nowIso() }));
    d.tasks.push(...created);
    return clone(created);
  },
  async crmUpdateTask(id, patch) {
    const d = await db();
    const t = find(d.tasks, id, "Tâche");
    if (patch.dueOn && patch.dueOn !== t.dueOn) t.remindedAt = null;
    if (patch.ownerId !== undefined && patch.ownerId !== t.ownerId) t.remindedAt = null;
    Object.assign(t, patch);
    return clone(t);
  },
  async crmSetTaskDone(id, done) {
    const d = await db();
    const t = find(d.tasks, id, "Tâche");
    t.doneAt = done ? nowIso() : null;
    return clone(t);
  },
  async crmMarkTasksReminded(ids) {
    const d = await db();
    const at = nowIso();
    d.tasks.forEach((t) => ids.includes(t.id) && (t.remindedAt = at));
  },

  async crmSaveSegment(input, id, actorId) {
    const d = await db();
    if (id) {
      const s = find(d.segments, id, "Segment");
      Object.assign(s, input, { updatedAt: nowIso() });
      return clone(s);
    }
    const s = { id: randomUUID(), ...input, createdBy: actorId, createdAt: nowIso(), updatedAt: nowIso() };
    d.segments.push(s);
    return clone(s);
  },
  async crmDeleteSegment(id) {
    const d = await db();
    d.segments = d.segments.filter((s) => s.id !== id);
  },
};
