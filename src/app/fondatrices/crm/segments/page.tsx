import type { Metadata } from "next";
import Link from "next/link";
import { DeleteSegmentButton, SaveSegmentButton } from "@/components/crm/SegmentButtons";
import { Icon } from "@/components/ui/Icon";
import { describeFilter, filterRows, filterToQuery } from "@/lib/modules/crm/domain";
import { loadCrm, ownerName } from "@/lib/modules/crm/load";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/modules/crm/types";

export const metadata: Metadata = { title: "Segments" };
export const dynamic = "force-dynamic";

/** Segments enregistrés : filtres combinables, nombre de contacts à jour, accès aux actions groupées. */
export default async function SegmentsPage() {
  const { data, rows, today, owners } = await loadCrm();
  const stages = new Map(data.stages.map((s) => [s.id, s.label]));
  const labels = { owner: (id: string) => ownerName(owners, id), stage: (id: string) => stages.get(id) ?? "?", status: (s: keyof typeof STATUS_LABEL) => STATUS_LABEL[s], source: (s: keyof typeof SOURCE_LABEL) => SOURCE_LABEL[s] };
  return (
    <>
      <div className="crm-head">
        <div>
          <div className="eyebrow">{data.segments.length} segments enregistrés</div>
          <h1>Segments</h1>
        </div>
        <div className="actions">
          <Link className="btn btn-ink btn-sm" href="/fondatrices/crm/contacts">
            <Icon name="plus" />
            Créer depuis les filtres
          </Link>
        </div>
      </div>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: 14.5, maxWidth: 720 }}>
        Un segment garde une combinaison de filtres : sa liste se met à jour toute seule. Ouvrez-le pour sélectionner les contacts et lancer une action groupée (étiquette, assignation, tâche, export, message préparé).
      </p>
      <div className="seg-cards">
        {data.segments.map((s) => {
          const list = filterRows(rows, s.filters, today);
          const q = filterToQuery(s.filters);
          return (
            <section key={s.id} className="card seg-card">
              <h3>{s.name}</h3>
              {s.description && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{s.description}</p>}
              <div className="fchips" style={{ margin: 0 }}>
                {describeFilter(s.filters, labels).map((c) => (
                  <span key={c} className="fchip">
                    {c}
                  </span>
                ))}
              </div>
              <div className="cnt">
                {list.length}
                <small>contact{list.length > 1 ? "s" : ""}</small>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                {list
                  .slice(0, 4)
                  .map((r) => r.name)
                  .join(", ")}
                {list.length > 4 ? "…" : ""}
              </p>
              <div className="btn-row">
                <Link className="btn btn-ink btn-xs" href={`/fondatrices/crm/contacts?${q}&seg=${s.id}`}>
                  Ouvrir
                </Link>
                <a className="btn btn-ghost btn-xs" href={`/fondatrices/crm/export?${q}`}>
                  Exporter
                </a>
                <SaveSegmentButton filters={s.filters} segment={{ id: s.id, name: s.name, description: s.description }} label="Renommer" />
                <DeleteSegmentButton id={s.id} name={s.name} />
              </div>
            </section>
          );
        })}
        {!data.segments.length && (
          <div className="empty">
            <Icon name="star" />
            Aucun segment. Filtrez la liste des contacts puis « Enregistrer comme segment ».
          </div>
        )}
      </div>
    </>
  );
}
