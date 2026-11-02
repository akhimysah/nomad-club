import Link from "next/link";
import type { PlaceCategory } from "@/lib/types";
import { EventImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";

/** Fiche d'une pro abonnée, telle qu'affichée dans le carnet (mise en avant). */
export type CarnetPro = {
  id: string;
  slug: string;
  name: string;
  category: string;
  carnetCategory: PlaceCategory | null;
  area: string | null;
  description: string | null;
  phone: string | null;
  hours: string | null;
  memberDiscount: string | null;
  photo: string | null;
  /** Formule Vitrine : en tête de sa catégorie. */
  featured: boolean;
};

export function ProCard({ p, i = 0 }: { p: CarnetPro; i?: number }) {
  const style = { animationDelay: `${Math.min(i, 12) * 0.04}s` };
  return (
    <article className={"place pro" + (p.photo ? "" : " compact")} style={style}>
      {p.photo && (
        <div className="ph">
          <EventImage image={p.photo} alt={p.name} />
          <span className="chip glass">{p.category}</span>
        </div>
      )}
      <div className="place-body">
        <div className="place-top">
          {!p.photo && <span className="place-kind">{p.category}</span>}
          <span className="pro-badge">
            <Icon name="star" />
            Pro du réseau
          </span>
        </div>
        <h3>{p.name}</h3>
        <div className="place-where">
          <Icon name="pin" />
          {p.area ?? "Marrakech"}
        </div>
        {p.description && <p>{p.description}</p>}
        {(p.phone || p.hours) && (
          <ul className="place-info">
            {p.phone && (
              <li>
                <Icon name="phone" />
                <a href={`/espace/fiche/${p.slug}/aller?vers=telephone`}>{p.phone}</a>
              </li>
            )}
            {p.hours && (
              <li>
                <Icon name="clock" />
                <span>{p.hours}</span>
              </li>
            )}
          </ul>
        )}
        {p.memberDiscount && (
          <div className="place-was">
            <Icon name="gift" />
            <span>Membres : {p.memberDiscount}</span>
          </div>
        )}
        <Link className="more" href={`/espace/fiche/${p.slug}`}>
          Voir la fiche <Icon name="arrow-r" />
        </Link>
      </div>
    </article>
  );
}
