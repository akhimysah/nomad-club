import type { Metadata } from "next";
import Link from "next/link";
import { NewTask, TaskList } from "@/components/crm/ContactPanels";
import { ActionButton } from "@/components/founders/ActionButton";
import { Avatar } from "@/components/ui/Avatar";
import { getViewer } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { computeDashboard } from "@/lib/domain/founders";
import { money } from "@/lib/format";
import { profileContactId } from "@/lib/modules/crm/sync";
import { taskBuckets } from "@/lib/modules/crm/domain";
import { loadCrm } from "@/lib/modules/crm/load";
import { taskView } from "@/lib/modules/crm/views";

export const metadata: Metadata = { title: "Tâches" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ qui?: string }> };

const CAT: Record<string, string> = { renew: "Renouvellement", lapsed: "Adhésion échue", unpaid: "Billets impayés", free: "Compte gratuit" };

/** Mes tâches du jour et en retard (ou celles de l'équipe) + relances du club (renouvellements, impayés). */
export default async function TasksPage({ searchParams }: Props) {
  const { qui } = await searchParams;
  const crm = await loadCrm();
  const { data, owners, today, rows, snapshot } = crm;
  const v = await getViewer();
  const me = v.profile?.id ?? "";
  const who = qui === "toutes" ? undefined : qui && owners.some((o) => o.id === qui) ? qui : me;
  const b = taskBuckets(data.tasks, today, who);
  const tv = (l: typeof b.today) => l.map((t) => taskView(t, crm));
  const soon = b.upcoming.filter((t) => t.dueOn <= new Date(Date.parse(today + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10));
  const later = b.upcoming.filter((t) => !soon.includes(t));
  const contacts = rows.map((r) => ({ id: r.contact.id, name: r.name })).sort((a, b2) => a.name.localeCompare(b2.name, "fr"));

  // relances existantes de l'espace fondatrices (mêmes règles que « À traiter »)
  const rel = computeDashboard(snapshot, nowMs()).rel;
  const contactOf = (profileId: string | null) => {
    if (!profileId) return null;
    const r = rows.find((x) => x.profile?.id === profileId);
    return r?.contact.id ?? profileContactId(profileId);
  };

  const label = who === undefined ? "Toute l’équipe" : who === me ? "Mes tâches" : `Tâches de ${owners.find((o) => o.id === who)?.first}`;
  return (
    <>
      <div className="crm-head">
        <div>
          <div className="eyebrow">
            {b.overdue.length} en retard · {b.today.length} aujourd’hui · {b.upcoming.length} à venir
          </div>
          <h1>{label}</h1>
        </div>
        <nav className="crm-tabs" aria-label="Responsable">
          <Link href="/fondatrices/crm/taches" className={who === me ? "on" : undefined}>
            Moi
          </Link>
          {owners
            .filter((o) => o.id !== me)
            .map((o) => (
              <Link key={o.id} href={`/fondatrices/crm/taches?qui=${o.id}`} className={who === o.id ? "on" : undefined}>
                {o.first}
              </Link>
            ))}
          <Link href="/fondatrices/crm/taches?qui=toutes" className={who === undefined ? "on" : undefined}>
            Toutes
          </Link>
        </nav>
      </div>

      <div className="ov-grid">
        <section className="card">
          <NewTask contactId={null} owners={owners} me={me} today={today} contacts={contacts} />
          <div className="tsec late">
            <h3>
              En retard <span className="n">{b.overdue.length}</span>
            </h3>
            <TaskList tasks={tv(b.overdue)} today={today} empty="Rien en retard." />
          </div>
          <div className="tsec">
            <h3>
              Aujourd’hui <span className="n">{b.today.length}</span>
            </h3>
            <TaskList tasks={tv(b.today)} today={today} empty="Rien de prévu aujourd’hui." />
          </div>
          <div className="tsec">
            <h3>
              7 prochains jours <span className="n">{soon.length}</span>
            </h3>
            <TaskList tasks={tv(soon)} today={today} empty="Rien cette semaine." />
          </div>
          {later.length > 0 && (
            <div className="tsec">
              <h3>
                Plus tard <span className="n">{later.length}</span>
              </h3>
              <TaskList tasks={tv(later)} today={today} />
            </div>
          )}
          {b.done.length > 0 && (
            <details className="cmore tsec">
              <summary>Faites récemment ({b.done.length})</summary>
              <TaskList tasks={tv(b.done.slice(0, 20))} today={today} />
            </details>
          )}
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Relances du club</h2>
            <Link href="/fondatrices/a-traiter" className="link" style={{ fontSize: 14 }}>
              Tout dans À traiter
            </Link>
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 6px" }}>
            Renouvellements, adhésions échues, billets impayés et comptes gratuits, calculés depuis les adhésions et les paiements.
          </p>
          {!rel.length && <div className="empty">Aucune relance en attente.</div>}
          <ul className="tasks">
            {rel.slice(0, 25).map((r) => {
              const cid = contactOf(r.profileId);
              return (
                <li key={r.key} className="task" data-row={`crm-${r.key}`} style={{ gridTemplateColumns: "34px minmax(0,1fr) auto" }}>
                  <Avatar name={r.name} />
                  <span>
                    <b>{cid ? <Link href={`/fondatrices/crm/contacts/${cid}`}>{r.name}</Link> : r.name}</b>
                    <small>
                      <span className={r.urgent ? "late" : undefined}>{CAT[r.cat]}</span> · {r.what} · {r.when} · {r.last}
                      {r.amount ? ` · ${money(r.amount)}` : ""}
                    </small>
                  </span>
                  <ActionButton kind={r.cat === "free" ? "invite" : "rel"} target={r.key} rowKey={`crm-${r.key}`} label={r.cat === "free" ? "Inviter" : "Relancer"} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
