import type { Metadata } from "next";
import Link from "next/link";
import { MonthCalendar } from "@/components/communaute/MonthCalendar";
import { BigEventCard } from "@/components/events/EventBits";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { isYearMonth, isYmd } from "@/lib/modules/communaute/domain";
import { upcomingFor } from "@/lib/views";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ vue?: string; mois?: string; jour?: string }> };

export default async function MemberAgenda({ searchParams }: Props) {
  const v = await requireMember();
  const sp = await searchParams;
  const calendar = sp.vue === "calendrier"; // Lot 1 : vue calendrier mensuelle
  const { events, mine } = await upcomingFor(v);
  const t = today();
  const all = calendar ? await getRepo().listEvents({ status: "published" }) : [];
  const ym = isYearMonth(sp.mois) ? sp.mois : t.slice(0, 7);
  const day = isYmd(sp.jour) && sp.jour.startsWith(ym) ? sp.jour : null;
  return (
    <Screen group="member" index={1} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Agenda</div>
            <h1 className="scr-title">Les prochains rendez-vous</h1>
            <p className="scr-sub">Tu paies le tarif adhérente. Les rendez-vous Premium sont offerts aux Premium.</p>
          </div>
          <div className="cm-view" role="tablist" aria-label="Affichage">
            <Link role="tab" aria-selected={!calendar} className={"fchip" + (!calendar ? " on" : "")} href="/espace/agenda">
              Liste
            </Link>
            <Link role="tab" aria-selected={calendar} className={"fchip" + (calendar ? " on" : "")} href="/espace/agenda?vue=calendrier">
              <Icon name="cal" /> Calendrier
            </Link>
          </div>
        </div>
        {calendar ? (
          <MonthCalendar events={all} mine={new Set([...mine].filter(([, s]) => s === "booked").map(([id]) => id))} ym={ym} day={day} today={t} base="/espace/agenda" />
        ) : (
          <div className="m-ev-grid">
            {events.map((e) => (
              <BigEventCard key={e.id} ev={e} mine={mine.get(e.id) ?? null} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
