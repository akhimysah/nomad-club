import type { Metadata } from "next";
import Link from "next/link";
import { ACTIVITY_ICON } from "@/components/crm/bits";
import { TaskList } from "@/components/crm/ContactPanels";
import { Icon } from "@/components/ui/Icon";
import { getViewer } from "@/lib/auth";
import { dayMonthShort, money } from "@/lib/format";
import { filterRows, filterToQuery, findDuplicates, taskBuckets } from "@/lib/modules/crm/domain";
import { loadCrm, ownerName, rowName } from "@/lib/modules/crm/load";
import { ACTIVITY_LABEL } from "@/lib/modules/crm/types";
import { taskView } from "@/lib/modules/crm/views";

export const metadata: Metadata = { title: "Aperçu" };
export const dynamic = "force-dynamic";

/** Accueil du CRM : mes tâches, pipeline, segments utiles, derniers échanges. */
export default async function CrmHome() {
  const crm = await loadCrm();
  const { data, rows, rowById, owners, today } = crm;
  const v = await getViewer();
  const me = v.profile?.id ?? "";
  const b = taskBuckets(data.tasks, today, me);
  const stages = [...data.stages].sort((a, z) => a.position - z.position);
  const byStage = stages.map((s) => {
    const d = data.deals.filter((x) => x.stageId === s.id);
    return { stage: s, count: d.length, value: d.reduce((a, x) => a + x.value, 0) };
  });
  const maxCount = Math.max(1, ...byStage.map((x) => x.count));
  const open = byStage.filter((x) => x.stage.outcome === "open");
  const prospects = rows.filter((r) => r.status === "prospect").length;
  const expiring = filterRows(rows, { expiresWithin: 30 }, today).length;
  const eventNo = filterRows(rows, { eventNoMembership: true }, today).length;
  const dups = findDuplicates(rows).length;
  const recent = [...data.activities]
    .filter((a) => a.type !== "system")
    .sort((a, z) => (a.occurredAt < z.occurredAt ? 1 : -1))
    .slice(0, 8);

  return (
    <>
      <div className="crm-head">
        <div>
          <div className="eyebrow">
            {rows.length} contacts · {prospects} prospects · {open.reduce((a, x) => a + x.count, 0)} opportunités en cours
          </div>
          <h1>CRM</h1>
        </div>
        <div className="actions">
          <Link className="btn btn-ghost btn-sm" href="/fondatrices/crm/import">
            Importer
          </Link>
          <Link className="btn btn-ink btn-sm" href="/fondatrices/crm/contacts/nouveau">
            <Icon name="plus" />
            Nouveau contact
          </Link>
        </div>
      </div>

      <div className="skpis">
        <Link href="/fondatrices/crm/taches" className="card skpi">
          <div className="lbl">Mes tâches</div>
          <div className="val">{b.overdue.length + b.today.length}</div>
          <div className="sub">
            {b.overdue.length} en retard · {b.today.length} aujourd’hui
          </div>
        </Link>
        <Link href="/fondatrices/crm/pipeline" className="card skpi">
          <div className="lbl">Pipeline ouvert</div>
          <div className="val">{open.reduce((a, x) => a + x.count, 0)}</div>
          <div className="sub">{money(open.reduce((a, x) => a + x.value, 0))} estimés</div>
        </Link>
        <Link href="/fondatrices/crm/contacts?exp=30" className="card skpi">
          <div className="lbl">Adhésions à renouveler</div>
          <div className="val">{expiring}</div>
          <div className="sub">expirent dans les 30 jours</div>
        </Link>
        <Link href="/fondatrices/crm/contacts?evt=1" className="card skpi">
          <div className="lbl">Venues sans adhérer</div>
          <div className="val">{eventNo}</div>
          <div className="sub">déjà venues à un rendez-vous</div>
        </Link>
      </div>

      <div className="ov-grid">
        <div className="ccol">
          <section className="card">
            <div className="card-h">
              <h2>Mes tâches du jour</h2>
              <Link href="/fondatrices/crm/taches" className="link" style={{ fontSize: 14 }}>
                Toutes mes tâches
              </Link>
            </div>
            {b.overdue.length > 0 && (
              <div className="tsec late">
                <h3>
                  En retard <span className="n">{b.overdue.length}</span>
                </h3>
                <TaskList tasks={b.overdue.map((t) => taskView(t, crm))} today={today} />
              </div>
            )}
            <div className="tsec">
              <h3>
                Aujourd’hui <span className="n">{b.today.length}</span>
              </h3>
              <TaskList tasks={b.today.map((t) => taskView(t, crm))} today={today} empty="Rien de prévu aujourd’hui." />
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Derniers échanges</h2>
            </div>
            <ul className="timeline">
              {recent.map((a) => (
                <li key={a.id}>
                  <span className="t-ic" title={ACTIVITY_LABEL[a.type]}>
                    <Icon name={ACTIVITY_ICON[a.type]} />
                  </span>
                  <span>
                    <p>
                      <Link href={`/fondatrices/crm/contacts/${a.contactId}`}>
                        <b>{rowName(rowById, a.contactId)}</b>
                      </Link>{" "}
                      · {a.body}
                    </p>
                    <small>
                      {ACTIVITY_LABEL[a.type]} · {dayMonthShort(a.occurredAt)} · {ownerName(owners, a.authorId)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="ccol">
          <section className="card">
            <div className="card-h">
              <h2>Pipeline</h2>
              <Link href="/fondatrices/crm/pipeline" className="link" style={{ fontSize: 14 }}>
                Ouvrir
              </Link>
            </div>
            <ul className="pipe-mini">
              {byStage.map((x) => (
                <li key={x.stage.id}>
                  <span>{x.stage.label}</span>
                  <span className="track">
                    <i style={{ width: `${(x.count / maxCount) * 100}%`, background: x.stage.outcome === "lost" ? "#c5c5c5" : undefined }} />
                  </span>
                  <span className="num">{x.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Segments</h2>
              <Link href="/fondatrices/crm/segments" className="link" style={{ fontSize: 14 }}>
                Tous
              </Link>
            </div>
            <ul className="mini-list">
              {data.segments.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <Link href={`/fondatrices/crm/contacts?${filterToQuery(s.filters)}&seg=${s.id}`}>{s.name}</Link>
                  <span>{filterRows(rows, s.filters, today).length}</span>
                </li>
              ))}
            </ul>
            {dups > 0 && (
              <Link href="/fondatrices/crm/contacts/doublons" className="rule">
                <Icon name="users" />
                <span>
                  {dups} doublon{dups > 1 ? "s" : ""} probable{dups > 1 ? "s" : ""} à fusionner
                </span>
              </Link>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
