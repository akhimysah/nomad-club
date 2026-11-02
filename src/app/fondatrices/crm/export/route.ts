import { audit } from "@/lib/audit";
import { checkCapability } from "@/lib/auth";
import { toCsv } from "@/lib/modules/crm/csv";
import { filterFromParams, filterRows, isEmptyFilter } from "@/lib/modules/crm/domain";
import { loadCrm, ownerName } from "@/lib/modules/crm/load";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/modules/crm/types";

export const dynamic = "force-dynamic";

/** Export CSV des contacts (filtres de l'adresse, ou sélection `ids=`). Journalisé. */
export async function GET(req: Request) {
  const v = await checkCapability("crm.export");
  if (!v) return new Response("Réservé aux fondatrices.", { status: 403 });
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const { rows, today, owners } = await loadCrm();
  const ids = (sp.ids ?? "").split(",").filter(Boolean);
  const filter = filterFromParams(sp);
  const list = ids.length ? rows.filter((r) => ids.includes(r.contact.id)) : filterRows(rows, filter, today);
  const csv = toCsv(
    ["Prénom", "Nom", "Société", "Métier", "E-mail", "Téléphone", "Instagram", "Ville", "Statut", "Source", "Étiquettes", "Consentement marketing", "Responsable", "Compte appli", "Fin d'adhésion", "Étape pipeline", "Créé le", "Notes"],
    list.map((r) => [
      r.profile?.firstName ?? r.contact.firstName,
      r.profile?.lastName ?? r.contact.lastName,
      r.organizationName ?? "",
      r.contact.job ?? r.profile?.job ?? "",
      r.email ?? "",
      r.phone ?? "",
      r.contact.instagram ?? "",
      r.contact.city ?? "",
      STATUS_LABEL[r.status],
      SOURCE_LABEL[r.contact.source],
      r.contact.tags.join(", "),
      r.contact.marketingConsent ? "oui" : "non",
      ownerName(owners, r.contact.ownerId),
      r.profile ? "oui" : "non",
      r.planEndsAt ?? "",
      r.stage?.label ?? "",
      r.contact.createdAt.slice(0, 10),
      r.contact.notes,
    ]),
  );
  await audit({
    actorId: v.profile.id,
    action: "crm.contact_export",
    targetType: "crm_contact",
    targetId: null,
    summary: `Export CSV : ${list.length} contact${list.length > 1 ? "s" : ""}`,
    details: { count: list.length, selection: ids.length > 0, filter: isEmptyFilter(filter) ? null : filter },
  });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="nomad-club-contacts-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
