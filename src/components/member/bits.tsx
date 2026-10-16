import type { Place } from "@/lib/types";
import { ymdLong } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { EventImage, NoImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";

/** Carte d'une adresse du carnet. */
export function PlaceCard({ p, i = 0 }: { p: Place; i?: number }) {
  return (
    <article className="place" style={{ animationDelay: `${i * 0.04}s` }}>
      {p.image ? (
        <div className="ph">
          <EventImage image={p.image} position={p.imagePosition} alt={p.name} />
          <span className="chip glass">{p.kind}</span>
        </div>
      ) : (
        <div className="ph noimg">
          <NoImage label={p.name} chip={<span className="chip glass">{p.kind}</span>} />
        </div>
      )}
      <div className="place-body">
        <h3>{p.name}</h3>
        <div className="place-where">
          <Icon name="pin" />
          {p.area}
        </div>
        <p>{p.note}</p>
        {p.clubEventLabel && (
          <div className="place-was">
            <Icon name="ticket" />
            <span>
              Le club y était : {p.clubEventLabel}
              {p.clubEventDate ? `, ${ymdLong(p.clubEventDate)}` : ""}
            </span>
          </div>
        )}
        <div className="place-rec">
          <Avatar name={p.recommendedBy} />
          Recommandé par {p.recommendedBy}
        </div>
      </div>
    </article>
  );
}
