import Link from "next/link";
import { dayLong, dayShort, hour, placesText, timeRange } from "@/lib/format";
import type { EventView } from "@/lib/types";
import { EventImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";

export type Ctx = "visit" | "member";

/** État d'une personne vis-à-vis d'un rendez-vous. */
export type Mine = "booked" | "waitlist" | null;

export function StatusChip({ ev, mine, glass }: { ev: EventView; mine: Mine; glass?: boolean }) {
  const g = glass ? " glass" : "";
  if (mine === "booked")
    return (
      <span className={"chip gold" + g}>
        <Icon name="check" />
        Ta place est réservée
      </span>
    );
  if (mine === "waitlist") return <span className={"chip" + g}>Sur la liste d’attente</span>;
  const l = ev.stats.left;
  if (l <= 0) return <span className={"chip rose" + g}>Complet · {ev.stats.waitlist} en attente</span>;
  if (ev.premiumFree)
    return (
      <span className={"chip gold" + g}>
        <Icon name="crown" />
        Réservé Premium · {l} places
      </span>
    );
  if (l === 1) return <span className={"chip rose pulse" + g}>Plus qu’une place</span>;
  return <span className={"chip" + g}>{placesText(l)}</span>;
}

export function PriceBlock({ ev, ctx }: { ev: EventView; ctx: Ctx }) {
  if (ev.premiumFree)
    return (
      <>
        <b style={{ fontSize: 17, fontFamily: "var(--sans)", fontWeight: 600 }}>Offert</b>
        <small>aux Premium</small>
      </>
    );
  if (ctx === "member")
    return (
      <>
        <b>{ev.priceMember}&nbsp;$</b>
        <small>tarif adhérente</small>
      </>
    );
  return (
    <>
      <b>{ev.pricePublic}&nbsp;$</b>
      <small>{ev.priceMember}&nbsp;$ adhérentes</small>
    </>
  );
}

export function eventHref(ev: { slug: string }, ctx: Ctx) {
  return ctx === "member" ? `/espace/agenda/${ev.slug}` : `/rendez-vous/${ev.slug}`;
}

export function EventRow({ ev, ctx, mine }: { ev: EventView; ctx: Ctx; mine: Mine }) {
  return (
    <Link href={eventHref(ev, ctx)} className="ev-row" data-fly>
      <span className="ph ev-thumb">
        <EventImage image={ev.image} position={ev.imagePosition} zoom={ev.imageZoom} />
      </span>
      <span className="ev-info">
        <span className="ev-when">
          {dayShort(ev.startsAt)} · {hour(ev.startsAt)}
        </span>
        <span className="ev-title">{ev.title}</span>
        <span className="ev-place">
          <Icon name="pin" />
          {ev.venue ?? "Lieu à confirmer"}
        </span>
        <StatusChip ev={ev} mine={mine} />
      </span>
      <span className="ev-price">
        <PriceBlock ev={ev} ctx={ctx} />
      </span>
    </Link>
  );
}

export function FeatureCard({ ev, mine }: { ev: EventView; mine: Mine }) {
  return (
    <Link href={eventHref(ev, "visit")} className="feature" data-fly>
      <span className="ph">
        <EventImage image={ev.image} position={ev.imagePosition} alt={ev.imageCaption ?? ev.title} />
        <span className="veil" />
      </span>
      <span className="feat-top">
        <span className="chip solid">
          <Icon name="star" />À la une
        </span>
        <StatusChip ev={ev} mine={mine} glass />
      </span>
      {ev.imageCaption && <span className="cap">Photo : {ev.imageCaption}</span>}
      <span className="feat-bot">
        <span className="feat-when">
          {dayLong(ev.startsAt)} · {timeRange(ev.startsAt, ev.endsAt)}
        </span>
        <span className="feat-title h-display">{ev.title}</span>
        <span className="feat-desc">{ev.description}</span>
        <span className="feat-meta">
          <Icon name="pin" />
          {ev.venue}
          {ev.address ? `, ${ev.address}` : ""}
        </span>
        <span className="feat-foot">
          <span className="feat-price">
            <b>{ev.pricePublic}&nbsp;$</b>tarif public<i>·</i>
            <b>{ev.priceMember}&nbsp;$</b>adhérentes
          </span>
          <span className="btn btn-gold btn-sm as-btn">
            Réserver ma place <Icon name="arrow-r" />
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Grande carte de l'agenda membre. */
export function BigEventCard({ ev, mine }: { ev: EventView; mine: Mine }) {
  return (
    <Link href={eventHref(ev, "member")} className="big-ev" data-fly>
      <span className="ph">
        <EventImage image={ev.image} position={ev.imagePosition} />
        <span className="veil" />
      </span>
      <span className="feat-top">
        {ev.featured && (
          <span className="chip solid">
            <Icon name="star" />À la une
          </span>
        )}
        <StatusChip ev={ev} mine={mine} glass />
      </span>
      <span className="feat-bot">
        <span className="feat-when">
          {dayLong(ev.startsAt)} · {timeRange(ev.startsAt, ev.endsAt)}
        </span>
        <span className="feat-title h-display">{ev.title}</span>
        <span className="feat-meta">
          <Icon name="pin" />
          {ev.venue}
          {ev.address ? `, ${ev.address}` : ""}
        </span>
        <span className="feat-foot">
          <span className="feat-price">
            {ev.premiumFree ? (
              <>
                <b>Offert</b> aux Premium
              </>
            ) : (
              <>
                <b>{ev.priceMember}&nbsp;$</b> tarif adhérente
              </>
            )}
          </span>
          <span className="link" style={{ color: "#e0e0e0" }}>
            Voir le détail <Icon name="arrow-r" />
          </span>
        </span>
      </span>
    </Link>
  );
}
