import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTIVITY_ICON, StatusChip, Tags } from "@/components/crm/bits";
import { ActivityComposer, DealBox, DetailsCard, MergeBox, NewTask, TaskList } from "@/components/crm/ContactPanels";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { getViewer } from "@/lib/auth";
import { daysBetween, ymdOf } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dayMonthShort, hour, money, PLAN_LABEL, ymdShortYear } from "@/lib/format";
import { whatsappLink } from "@/lib/modules/crm/message";
import { findDuplicates } from "@/lib/modules/crm/domain";
import { loadCrm, ownerName } from "@/lib/modules/crm/load";
import { ACTIVITY_LABEL, SOURCE_LABEL } from "@/lib/modules/crm/types";
import { formValues, taskView } from "@/lib/modules/crm/views";
import { ROLE_LABEL } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { rowById } = await loadCrm();
  return { title: rowById.get(id)?.name ?? "Contact" };
}

const ACTION_LABEL: Record<string, string> = { join: "Adhésion", renew: "Renouvellement", upgrade: "Passage à Premium" };

/** Fiche contact : coordonnées, historique d'échanges, tâches, pipeline, adhésion et paiements, contrats, fusion. */
export default async function ContactPage({ params }: Props) {
  const { id } = await params;
  const crm = await loadCrm();
  const { rows, rowById, data, owners, today, snapshot } = crm;
  const r = rowById.get(id);
  if (!r) notFound();
  const v = await getViewer();
  const me = v.profile?.id ?? owners[0]?.id ?? "";
  const c = r.contact;
  const p = r.profile;

  const activities = data.activities.filter((a) => a.contactId === id).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  const tasks = data.tasks.filter((t) => t.contactId === id).sort((a, b) => (!!a.doneAt === !!b.doneAt ? (a.dueOn < b.dueOn ? -1 : 1) : a.doneAt ? 1 : -1));
  const deals = data.deals.filter((d) => d.contactId === id);
  const stageOf = new Map(data.stages.map((s) => [s.id, s]));
  const names = new Map(owners.map((o) => [o.id, o.first]));

  // adhésion et paiements (données existantes de l'appli)
  const payments = p ? await getRepo().listPaymentsForProfile(p.id) : [];
  const bookings = p ? snapshot.bookings.filter((b) => b.profileId === p.id && b.status !== "cancelled") : [];
  const events = new Map(snapshot.events.map((e) => [e.id, e]));
  const reminders = p ? snapshot.reminders.filter((x) => x.profileId === p.id && x.sentAt).sort((a, b) => (a.sentAt! < b.sentAt! ? 1 : -1)) : [];
  const membershipPays = payments.filter((x) => x.kind === "membership").sort((a, b) => (a.declaredAt < b.declaredAt ? 1 : -1));
  const paid = payments.filter((x) => x.status === "validated").reduce((a, x) => a + x.amount, 0);
  const dueIn = p?.planEndsAt ? daysBetween(today, p.planEndsAt) : null;

  const dups = findDuplicates(rows)
    .filter((g) => g.rows.some((x) => x.contact.id === id))
    .flatMap((g) => g.rows.filter((x) => x.contact.id !== id && !(x.profile && p)).map((x) => ({ id: x.contact.id, name: x.name, reason: g.reason })));
  const uniqueDups = [...new Map(dups.map((d) => [d.id, d])).values()];
  const others = rows.filter((x) => x.contact.id !== id && !(x.profile && p)).map((x) => ({ id: x.contact.id, name: x.name }));
  const wa = whatsappLink(r.phone, `Bonjour ${p?.firstName || c.firstName}, `);

  return (
    <>
      <div className="crm-head">
        <div className="c-hero">
          <Avatar name={r.name} />
          <div>
            <Link href="/fondatrices/crm/contacts" className="eyebrow">
              ← Contacts
            </Link>
            <h1>{r.name}</h1>
            <div className="sub">
              <StatusChip status={r.status} />
              {r.organizationName && <span>{r.organizationName}</span>}
              {(c.job || p?.job) && <span>· {c.job || p?.job}</span>}
              {p && (
                <span className="acct">
                  <Icon name="user" />
                  compte de l’appli · {p.roles.length ? p.roles.map((x) => ROLE_LABEL[x]).join(", ") : ROLE_LABEL.guest}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="actions">
          {wa && (
            <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" />
              WhatsApp
            </a>
          )}
          {r.email && (
            <a className="btn btn-ghost btn-sm" href={`mailto:${r.email}`}>
              <Icon name="send" />
              E-mail
            </a>
          )}
          {p && (
            <Link className="btn btn-ghost btn-sm" href={`/fondatrices/membres?q=${encodeURIComponent(r.name)}`}>
              Fiche membre
            </Link>
          )}
        </div>
      </div>

      <div className="cgrid2">
        <div className="ccol">
          <DetailsCard id={id} initial={formValues(c)} owners={owners} linked={!!p}>
            <dl className="kv">
              <dt>E-mail</dt>
              <dd>{r.email ?? "—"}</dd>
              <dt>Téléphone</dt>
              <dd>{r.phone ?? "—"}</dd>
              {c.instagram && (
                <>
                  <dt>Instagram</dt>
                  <dd>{c.instagram}</dd>
                </>
              )}
              <dt>Ville</dt>
              <dd>{c.city ?? p?.country ?? "—"}</dd>
              <dt>Source</dt>
              <dd>{SOURCE_LABEL[c.source]}</dd>
              <dt>Suivi par</dt>
              <dd>{ownerName(owners, c.ownerId)}</dd>
              <dt>Étiquettes</dt>
              <dd>
                <Tags tags={c.tags} max={12} />
              </dd>
              <dt>Consentement</dt>
              <dd>{c.marketingConsent ? `accepte les messages${c.consentAt ? ` (depuis le ${ymdShortYear(ymdOf(c.consentAt))})` : ""}` : "n’a pas donné son accord"}</dd>
              <dt>Dans le CRM depuis</dt>
              <dd>{ymdShortYear(ymdOf(c.createdAt))}</dd>
            </dl>
            {c.notes && <div className="notes-box">{c.notes}</div>}
          </DetailsCard>

          <section className="card">
            <div className="card-h">
              <h2>Adhésion</h2>
              {p && <span className="muted">{money(paid)} payés au total</span>}
            </div>
            {!p ? (
              <div className="empty">
                <Icon name="user" />
                Pas encore de compte dans l’appli : l’adhésion apparaîtra ici dès son inscription.
              </div>
            ) : (
              <>
                <dl className="kv">
                  <dt>Formule</dt>
                  <dd>{PLAN_LABEL[p.plan]}</dd>
                  <dt>Échéance</dt>
                  <dd>
                    {p.planEndsAt ? ymdShortYear(p.planEndsAt) : "—"}
                    {dueIn !== null && (dueIn >= 0 ? (dueIn <= 30 ? ` · renouvellement dans ${dueIn} j` : "") : ` · échue depuis ${-dueIn} j`)}
                  </dd>
                  {p.cardNumber && (
                    <>
                      <dt>Carte</dt>
                      <dd>{p.cardNumber}</dd>
                    </>
                  )}
                  <dt>Relances</dt>
                  <dd>{reminders.length ? `${reminders.length}, la dernière le ${ymdShortYear(ymdOf(reminders[0].sentAt!))}` : "aucune"}</dd>
                </dl>
                <h3 className="mini-h">Adhésions et renouvellements</h3>
                {membershipPays.length ? (
                  <ul className="paylist">
                    {membershipPays.map((x) => (
                      <li key={x.id}>
                        <time>{ymdShortYear(ymdOf(x.validatedAt ?? x.declaredAt))}</time>
                        <span>
                          {ACTION_LABEL[x.membershipAction ?? "join"]} {x.plan ? PLAN_LABEL[x.plan] : ""}
                          {x.status === "declared" ? " · virement à valider" : x.status === "refunded" ? " · remboursé" : ""}
                        </span>
                        <b>{money(x.amount)}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: 14 }}>
                    Aucun paiement d’adhésion enregistré.
                  </p>
                )}
                <h3 className="mini-h">Rendez-vous et billets</h3>
                {bookings.length ? (
                  <ul className="paylist">
                    {bookings.map((b) => (
                      <li key={b.id}>
                        <time>{dayMonthShort(events.get(b.eventId)?.startsAt ?? b.createdAt)}</time>
                        <span>
                          {events.get(b.eventId)?.title ?? "Rendez-vous"}
                          {b.status === "pending" ? " · impayé" : b.status === "waitlist" ? " · liste d’attente" : ""}
                        </span>
                        <b>{b.amount ? money(b.amount) : "offert"}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: 14 }}>
                    Aucune réservation.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Contrats</h2>
            </div>
            <div className="empty">
              <Icon name="lock" />
              Aucun contrat. Les contrats adhérente et partenaire (génération, acceptation, PDF) apparaîtront ici avec le module Contrats.
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Doublons</h2>
            </div>
            <MergeBox keepId={id} candidates={uniqueDups} others={others} />
          </section>
        </div>

        <div className="ccol">
          <section className="card">
            <div className="card-h">
              <h2>Pipeline</h2>
              {deals.length > 1 && <span className="muted">{deals.length} opportunités</span>}
            </div>
            <DealBox
              key={r.deal?.id ?? "new"}
              contactId={id}
              deal={r.deal ? { id: r.deal.id, stageId: r.deal.stageId, title: r.deal.title, value: r.deal.value, lostReason: r.deal.lostReason, ownerId: r.deal.ownerId } : null}
              stages={data.stages.map((s) => ({ id: s.id, label: s.label, outcome: s.outcome }))}
              me={me}
            />
            {deals.length > 1 && (
              <ul className="paylist" style={{ marginTop: 10 }}>
                {deals
                  .filter((d) => d.id !== r.deal?.id)
                  .map((d) => (
                    <li key={d.id}>
                      <time>{ymdShortYear(ymdOf(d.createdAt))}</time>
                      <span>
                        {d.title} · {stageOf.get(d.stageId)?.label}
                        {d.lostReason ? ` (${d.lostReason})` : ""}
                      </span>
                      <b>{money(d.value)}</b>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Tâches</h2>
              <span className="muted">{tasks.filter((t) => !t.doneAt).length} à faire</span>
            </div>
            <NewTask contactId={id} owners={owners} me={me} today={today} />
            <div style={{ marginTop: 10 }}>
              <TaskList tasks={tasks.map((t) => taskView(t, crm))} today={today} empty="Aucune tâche pour ce contact." />
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Historique des échanges</h2>
              <span className="muted">{activities.filter((a) => a.type !== "system").length} échanges</span>
            </div>
            <ActivityComposer contactId={id} today={today} />
            <ul className="timeline">
              {activities.map((a) => (
                <li key={a.id} className={a.type}>
                  <span className="t-ic" title={ACTIVITY_LABEL[a.type]}>
                    <Icon name={ACTIVITY_ICON[a.type]} />
                  </span>
                  <span>
                    <p>{a.body}</p>
                    <small>
                      {ACTIVITY_LABEL[a.type]} · {dayMonthShort(a.occurredAt)} {ymdOf(a.occurredAt).slice(0, 4) !== today.slice(0, 4) ? ymdOf(a.occurredAt).slice(0, 4) : ""} · {hour(a.occurredAt)}
                      {a.authorId && names.get(a.authorId) ? ` · ${names.get(a.authorId)}` : ""}
                    </small>
                  </span>
                </li>
              ))}
              {!activities.length && <div className="empty">Pas encore d’échange. Notez le premier ci-dessus.</div>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
