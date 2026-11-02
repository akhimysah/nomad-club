import Link from "next/link";
import { monthGrid, shiftMonth } from "@/lib/modules/communaute/domain";
import { ymdOf } from "@/lib/clock";
import { monthLongName, timeRange, ymdLong } from "@/lib/format";
import type { EventView } from "@/lib/types";
import { Icon } from "../ui/Icon";

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Lot 1 — Calendrier mensuel des rendez-vous (sans JavaScript : la navigation passe par l'adresse).
 * `mine` : rendez-vous où la personne est inscrite (mis en avant).
 */
export function MonthCalendar({ events, mine, ym, day, today, base }: { events: EventView[]; mine: Set<string>; ym: string; day: string | null; today: string; base: string }) {
  const cells = monthGrid(ym);
  const byDay = new Map<string, EventView[]>();
  for (const e of events) {
    const d = ymdOf(e.startsAt);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const [y, m] = ym.split("-").map(Number);
  const href = (params: Record<string, string>) => `${base}?${new URLSearchParams({ vue: "calendrier", ...params }).toString()}`;
  const selected = day ? (byDay.get(day) ?? []) : events.filter((e) => ymdOf(e.startsAt).startsWith(ym));
  return (
    <section>
      <div className="cm-cal-head">
        <Link className="icon-btn" href={href({ mois: shiftMonth(ym, -1) })} aria-label="Mois précédent">
          <Icon name="chev-l" />
        </Link>
        <h2>
          {monthLongName(m - 1)} {y}
        </h2>
        <Link className="icon-btn" href={href({ mois: shiftMonth(ym, 1) })} aria-label="Mois suivant">
          <Icon name="chev-r" />
        </Link>
      </div>
      <div className="cm-cal" role="grid" aria-label={`Rendez-vous de ${monthLongName(m - 1)} ${y}`}>
        {DOW.map((d) => (
          <span key={d} className="dow" role="columnheader">
            {d}
          </span>
        ))}
        {cells.map((c) => {
          const evs = byDay.get(c.ymd) ?? [];
          const cls = [c.inMonth ? "" : "out", c.ymd === today ? "today" : "", c.ymd === day ? "sel" : ""].filter(Boolean).join(" ");
          const body = (
            <>
              <span className="num">{c.day}</span>
              {evs.map((e) => (
                <span key={e.id} className={"ev" + (mine.has(e.id) ? " mine" : "")} title={e.title}>
                  {e.shortTitle ?? e.title}
                </span>
              ))}
              {evs.length > 0 && (
                <span className="dots" aria-hidden="true">
                  {evs.map((e) => (
                    <i key={e.id} className={mine.has(e.id) ? "mine" : undefined} />
                  ))}
                </span>
              )}
            </>
          );
          return evs.length ? (
            <Link key={c.ymd} role="gridcell" className={cls} href={href({ mois: c.ymd.slice(0, 7), jour: c.ymd })} aria-label={`${ymdLong(c.ymd)} : ${evs.length} rendez-vous`}>
              {body}
            </Link>
          ) : (
            <span key={c.ymd} role="gridcell" className={"cell " + cls}>
              {body}
            </span>
          );
        })}
      </div>
      <div className="cm-day-list card">
        <div className="card-h">
          <h2>{day ? ymdLong(day) : `En ${monthLongName(m - 1)}`}</h2>
          {day && (
            <Link className="link" href={href({ mois: ym })}>
              Tout le mois
            </Link>
          )}
        </div>
        {selected.length ? (
          <ul className="mini-list">
            {selected.map((e) => (
              <li key={e.id}>
                <span>
                  <Link className="link" href={`/espace/agenda/${e.slug}`}>
                    {e.title}
                  </Link>
                  {mine.has(e.id) ? " · inscrite" : ""}
                </span>
                <span>
                  {day ? "" : ymdLong(ymdOf(e.startsAt)) + " · "}
                  {timeRange(e.startsAt, e.endsAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <Icon name="cal" />
            Pas de rendez-vous {day ? "ce jour-là" : "ce mois-ci"}.
          </div>
        )}
      </div>
    </section>
  );
}
