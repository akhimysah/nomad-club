import type { Metadata } from "next";
import { BigEventCard } from "@/components/events/EventBits";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { upcomingFor } from "@/lib/views";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function MemberAgenda() {
  const v = await requireMember();
  const { events, mine } = await upcomingFor(v);
  return (
    <Screen group="member" index={1} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Agenda</div>
            <h1 className="scr-title">Les prochains rendez-vous</h1>
            <p className="scr-sub">Tu paies le tarif adhérente. Les rendez-vous Premium sont offerts aux Premium.</p>
          </div>
        </div>
        <div className="m-ev-grid">
          {events.map((e) => (
            <BigEventCard key={e.id} ev={e} mine={mine.get(e.id) ?? null} />
          ))}
        </div>
      </div>
    </Screen>
  );
}
