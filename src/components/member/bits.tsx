import type { Place } from "@/lib/types";
import { ymdLong } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { EventImage, NoImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";

const BADGES: Record<NonNullable<Place["badge"]>, string> = { top: "Coup de cœur", new: "Nouveau", exclusive: "Exclusif" };

/** Lien « tel: » à partir du premier numéro affiché (« 15 / 141 » -> tel:15). */
function telHref(phone: string): string {
  const first = phone.split("/")[0];
  return "tel:" + first.replace(/[^\d+]/g, "");
}

/** Téléphone, adresse, horaires et site d'un lieu (seulement ce qui est connu). */
function PlaceInfo({ p }: { p: Place }) {
  if (!p.phone && !p.address && !p.hours && !p.url) return null;
  return (
    <ul className="place-info">
      {p.phone && (
        <li>
          <Icon name="phone" />
          <a href={telHref(p.phone)}>{p.phone}</a>
        </li>
      )}
      {p.address && (
        <li>
          <Icon name="pin" />
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address}, Marrakech`)}`} target="_blank" rel="noopener noreferrer">
            {p.address}
          </a>
        </li>
      )}
      {p.hours && (
        <li>
          <Icon name="clock" />
          <span>{p.hours}</span>
        </li>
      )}
      {p.url && (
        <li>
          <Icon name="globe" />
          <a href={p.url} target="_blank" rel="noopener noreferrer">
            {p.url.replace(/^https?:\/\//, "")}
          </a>
        </li>
      )}
    </ul>
  );
}

export function PlaceCard({ p, i = 0 }: { p: Place; i?: number }) {
  const style = { animationDelay: `${Math.min(i, 12) * 0.04}s` };
  const badge = p.badge ? <span className={"place-badge b-" + p.badge}>{BADGES[p.badge]}</span> : null;

  // Adresse de l'annuaire (sans photo ni marraine) : fiche compacte.
  if (!p.image && !p.recommendedBy) {
    return (
      <article className="place compact" style={style}>
        <div className="place-body">
          <div className="place-top">
            <span className="place-kind">{p.kind}</span>
            {badge}
          </div>
          <h3>{p.name}</h3>
          <div className="place-where">
            <Icon name="pin" />
            {p.area}
          </div>
          <p>{p.note}</p>
          <PlaceInfo p={p} />
          {p.tags.length > 0 && (
            <div className="place-tags">
              {p.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="place" style={style}>
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
        <PlaceInfo p={p} />
        {p.clubEventLabel && (
          <div className="place-was">
            <Icon name="ticket" />
            <span>
              Le club y était : {p.clubEventLabel}
              {p.clubEventDate ? `, ${ymdLong(p.clubEventDate)}` : ""}
            </span>
          </div>
        )}
        {p.recommendedBy && (
          <div className="place-rec">
            <Avatar name={p.recommendedBy} />
            Recommandé par {p.recommendedBy}
          </div>
        )}
      </div>
    </article>
  );
}
