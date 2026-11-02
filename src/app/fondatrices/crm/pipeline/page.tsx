import type { Metadata } from "next";
import Link from "next/link";
import { Kanban, NewDeal, StageEditor, type KCard } from "@/components/crm/Kanban";
import { getViewer } from "@/lib/auth";
import { daysBetween, ymdOf } from "@/lib/clock";
import { money, ymdShortYear } from "@/lib/format";
import { loadCrm, ownerName } from "@/lib/modules/crm/load";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ vue?: string; qui?: string }> };

/** Pipeline prospects → adhérentes : kanban (glisser-déposer + menu) ou liste. */
export default async function PipelinePage({ searchParams }: Props) {
  const { vue, qui } = await searchParams;
  const { data, rowById, owners, today, rows } = await loadCrm();
  const v = await getViewer();
  const me = v.profile?.id ?? "";
  const stages = [...data.stages].sort((a, b) => a.position - b.position);
  const ownerFilter = qui && owners.some((o) => o.id === qui) ? qui : null;
  const deals = data.deals.filter((d) => !ownerFilter || d.ownerId === ownerFilter);
  const cards: KCard[] = deals.map((d) => {
    const age = daysBetween(ymdOf(d.createdAt), today);
    return {
      id: d.id,
      stageId: d.stageId,
      position: d.position,
      title: d.title,
      value: d.value,
      contactId: d.contactId,
      name: rowById.get(d.contactId)?.name ?? "—",
      owner: ownerName(owners, d.ownerId),
      lostReason: d.lostReason,
      age: age < 1 ? "aujourd’hui" : age < 60 ? `${age} j` : `${Math.round(age / 30)} mois`,
    };
  });
  const outcome = new Map(stages.map((s) => [s.id, s.outcome]));
  const open = deals.filter((d) => outcome.get(d.stageId) === "open");
  const won = deals.filter((d) => outcome.get(d.stageId) === "won");
  const lost = deals.filter((d) => outcome.get(d.stageId) === "lost");
  const list = vue === "liste";
  const href = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const q = { vue: list ? "liste" : null, qui: ownerFilter, ...extra };
    Object.entries(q).forEach(([k, val]) => val && p.set(k, val));
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  const contacts = rows.filter((r) => r.status !== "equipe").map((r) => ({ id: r.contact.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <>
      <div className="crm-head">
        <div>
          <div className="eyebrow">
            {open.length} en cours · {money(open.reduce((a, d) => a + d.value, 0))} estimés · {won.length} gagnées · {lost.length} perdues
          </div>
          <h1>Pipeline</h1>
        </div>
        <div className="actions">
          <nav className="crm-tabs" aria-label="Affichage">
            <Link href={href({ vue: null })} className={!list ? "on" : undefined}>
              Colonnes
            </Link>
            <Link href={href({ vue: "liste" })} className={list ? "on" : undefined}>
              Liste
            </Link>
          </nav>
          <nav className="crm-tabs" aria-label="Responsable">
            <Link href={href({ qui: null })} className={!ownerFilter ? "on" : undefined}>
              Toutes
            </Link>
            {owners.map((o) => (
              <Link key={o.id} href={href({ qui: o.id })} className={ownerFilter === o.id ? "on" : undefined}>
                {o.first}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <NewDeal stages={stages} contacts={contacts} me={me} />
      </section>

      {list ? (
        <section className="card">
          <div className="ctable-wrap">
            <table className="ctable">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Opportunité</th>
                  <th>Étape</th>
                  <th className="num">Valeur</th>
                  <th className="hide-m">Suivi par</th>
                  <th className="hide-m">Créée le</th>
                  <th className="hide-m">Motif de perte</th>
                </tr>
              </thead>
              <tbody>
                {[...deals]
                  .sort((a, b) => (stages.findIndex((s) => s.id === a.stageId) - stages.findIndex((s) => s.id === b.stageId)) || a.position - b.position)
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/fondatrices/crm/contacts/${d.contactId}`}>
                          <b>{rowById.get(d.contactId)?.name}</b>
                        </Link>
                      </td>
                      <td>{d.title}</td>
                      <td>{stages.find((s) => s.id === d.stageId)?.label}</td>
                      <td className="num">{money(d.value)}</td>
                      <td className="hide-m">{ownerName(owners, d.ownerId)}</td>
                      <td className="hide-m muted">{ymdShortYear(ymdOf(d.createdAt))}</td>
                      <td className="hide-m muted">{d.lostReason ?? ""}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!deals.length && <div className="empty">Aucune opportunité.</div>}
        </section>
      ) : (
        <Kanban stages={stages.map((s) => ({ id: s.id, label: s.label, outcome: s.outcome }))} cards={cards} />
      )}

      <details className="cmore card" style={{ marginTop: 18 }}>
        <summary>
          Configurer les étapes du pipeline
        </summary>
        <StageEditor stages={stages.map((s) => ({ id: s.id, label: s.label, outcome: s.outcome }))} used={[...new Set(data.deals.map((d) => d.stageId))]} />
      </details>
    </>
  );
}
