import type { Metadata } from "next";
import { ActionButton } from "@/components/founders/ActionButton";
import { ChoosePlaceButton, EditEventButton, type EditableEvent } from "@/components/founders/FounderHost";
import { FHead, FillBar, Legend } from "@/components/founders/parts";
import { EventImage } from "@/components/ui/EventImage";
import { Screen } from "@/components/ui/Screen";
import { ScrollToHighlight } from "@/components/ui/ScrollToHighlight";
import { hmOf, ymdOf } from "@/lib/clock";
import { eventStats } from "@/lib/domain/events";
import { dayLong, timeRange } from "@/lib/format";
import { loadDashboard } from "@/lib/founders-view";
import { getRepo } from "@/lib/data";
import type { ClubEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Événements" };
export const dynamic = "force-dynamic";

function editable(e: ClubEvent): EditableEvent {
  return {
    id: e.id,
    title: e.title,
    status: e.status,
    date: ymdOf(e.startsAt),
    time: hmOf(e.startsAt),
    endTime: e.endsAt ? hmOf(e.endsAt) : "",
    placeId: e.placeId ?? "",
    capacity: e.capacity,
    pricePublic: e.pricePublic,
    priceMember: e.priceMember,
    premiumFree: e.premiumFree,
    description: e.description,
  };
}

type Props = { searchParams: Promise<{ nouveau?: string }> };

export default async function EventsPage({ searchParams }: Props) {
  const { nouveau } = await searchParams;
  const { d } = await loadDashboard();
  const snap = await getRepo().snapshot();
  const upcoming = snap.events.filter((e) => e.status === "published" && ymdOf(e.startsAt) >= d.today).sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const drafts = snap.events.filter((e) => e.status === "draft").sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  return (
    <Screen group="founders" index={3} className="fscreen scroller on">
      <div className="f-inner">
        <ScrollToHighlight token={nouveau} />
        <FHead title="Événements" sub="Remplissage et brouillons" withNew />
        <div style={{ margin: "-10px 0 18px" }}>
          <Legend />
        </div>
        <div className="fev-cards">
          {upcoming.map((e) => {
            const st = eventStats(e, snap.bookings);
            const l = st.left;
            return (
              <article key={e.id} className={"card fev-card" + (nouveau === e.id ? " new-hl" : "")}>
                <div className={"ph" + (e.image ? "" : " draft")}>
                  {e.image ? <EventImage image={e.image} position={e.imagePosition} zoom={e.imageZoom} /> : e.venue}
                  <span className={"chip " + (l <= 0 ? "rose" : "solid")}>{l <= 0 ? "Complet" : e.premiumFree ? "Premium" : "Publié"}</span>
                </div>
                <h3>{e.title}</h3>
                <div className="meta">
                  {dayLong(e.startsAt)} · {timeRange(e.startsAt, e.endsAt)} · {e.venue}
                </div>
                <FillBar stats={st} capacity={e.capacity} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--tx2)", gap: 8, flexWrap: "wrap" }}>
                  <span>
                    <b>
                      {st.taken}/{e.capacity}
                    </b>
                    {l > 0 ? ` · ${l} place${l > 1 ? "s" : ""}` : ""}
                    {st.waitlist && l <= 0 ? ` · ${st.waitlist} en liste d’attente` : ""}
                  </span>
                  <span>
                    {st.paid} payée{st.paid > 1 ? "s" : ""}
                    {st.pending ? ` · ${st.pending} en attente` : ""}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>{e.premiumFree ? "Offert aux Premium" : `Public ${e.pricePublic} $ · adhérentes ${e.priceMember} $`}</div>
                <div className="ev-edit">
                  <EditEventButton e={editable(e)} />
                </div>
              </article>
            );
          })}
          {drafts.map((e) => (
            <article key={e.id} className={"card fev-card" + (nouveau === e.id ? " new-hl" : "")} data-row={`draft:${e.id}`}>
              <div className="ph draft">
                Brouillon<span className="chip">Brouillon</span>
              </div>
              <h3>{e.title}</h3>
              <div className="meta">
                {dayLong(e.startsAt)} · {e.venue ?? <span style={{ color: "var(--rose)" }}>lieu à confirmer</span>} · {e.capacity} places
              </div>
              <div className="fill">
                <i style={{ width: 0 }} />
              </div>
              <div className="ev-edit">
                {e.venue ? <ActionButton kind="pub" target={e.id} rowKey={`draft:${e.id}`} label="Publier" /> : <ChoosePlaceButton d={{ id: e.id, title: e.title, date: dayLong(e.startsAt) }} />}
                <EditEventButton e={editable(e)} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </Screen>
  );
}
