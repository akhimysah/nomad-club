/**
 * Chargement serveur du CRM pour les pages : données CRM + ce que l'appli sait des personnes
 * (profils, réservations, paiements, établissements), assemblés en lignes enrichies.
 */
import { cache } from "react";
import { today as todayYmd } from "../../clock";
import { getRepo } from "../../data";
import { fullName } from "../../format";
import { isAdmin } from "../../permissions";
import { notify } from "../../notify";
import { buildRows, tasksToRemind } from "./domain";
import type { ContactRow } from "./types";

export type Owner = { id: string; name: string; first: string };

export const loadCrm = cache(async () => {
  const repo = getRepo();
  const [data, snapshot, organizations] = await Promise.all([repo.crmData(), repo.snapshot(), repo.listOrganizations()]);
  const today = todayYmd();
  const rows = buildRows(data, { profiles: snapshot.profiles, bookings: snapshot.bookings, organizations }, today);
  const owners: Owner[] = snapshot.profiles
    .filter(isAdmin)
    .map((p) => ({ id: p.id, name: fullName(p), first: p.firstName }))
    .sort((a, b) => a.first.localeCompare(b.first, "fr"));
  const rowById = new Map(rows.map((r) => [r.contact.id, r]));
  return { data, snapshot, organizations, today, rows, owners, rowById };
});

export type CrmLoad = Awaited<ReturnType<typeof loadCrm>>;

export function ownerName(owners: Owner[], id: string | null): string {
  if (!id) return "—";
  return owners.find((o) => o.id === id)?.first ?? "—";
}

export function rowName(rowById: Map<string, ContactRow>, id: string | null): string {
  return (id && rowById.get(id)?.name) || "—";
}

/**
 * Rappels in-app des tâches échues ou du jour (une seule fois par tâche).
 * Appelé à l'ouverture du CRM par une administratrice : pas de tâche planifiée nécessaire.
 */
export async function remindDueTasks(profileId: string): Promise<number> {
  try {
    const repo = getRepo();
    const { data, today, rowById } = await loadCrm();
    const due = tasksToRemind(data.tasks, today).filter((t) => t.ownerId === profileId);
    if (!due.length) return 0;
    await repo.crmMarkTasksReminded(due.map((t) => t.id));
    const late = due.filter((t) => t.dueOn < today).length;
    const names = due.slice(0, 3).map((t) => (t.contactId ? `${t.title} (${rowName(rowById, t.contactId)})` : t.title));
    await notify([
      {
        recipientId: profileId,
        type: "crm_task_due",
        title: due.length === 1 ? "Une tâche du CRM t’attend" : `${due.length} tâches du CRM t’attendent`,
        body: `${late ? `${late} en retard. ` : ""}${names.join(" · ")}${due.length > 3 ? "…" : ""}`.slice(0, 600),
        link: "/fondatrices/crm/taches",
      },
    ]);
    return due.length;
  } catch (e) {
    console.error("[crm] rappels :", e instanceof Error ? e.message : e);
    return 0;
  }
}
