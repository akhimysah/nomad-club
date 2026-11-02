"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalize } from "@/lib/format";
import { AUDIENCE_LABEL, CATEGORY_KEYS, CATEGORY_LABEL } from "@/lib/modules/partenaires/domain";
import type { OfferAudience } from "@/lib/modules/partenaires/types";
import type { PlaceCategory } from "@/lib/types";
import { EventImage, NoImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";

export type OfferListItem = {
  id: string;
  title: string;
  badge: string;
  detail: string;
  audience: OfferAudience;
  validUntil: string | null;
  orgName: string;
  orgSlug: string;
  area: string | null;
  category: PlaceCategory | null;
  photo: string | null;
};

/** Page Offres : toutes les offres actives des partenaires, filtrables par catégorie et cherchables. */
export function OffersBrowser({ offers }: { offers: OfferListItem[] }) {
  const [cat, setCat] = useState<PlaceCategory | "tout">("tout");
  const [q, setQ] = useState("");
  const index = useMemo(() => offers.map((o) => normalize([o.title, o.badge, o.detail, o.orgName, o.area ?? ""].join(" "))), [offers]);
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const found = offers.filter((_, i) => terms.every((t) => index[i].includes(t)));
  const list = found.filter((o) => cat === "tout" || o.category === cat);
  const cats = CATEGORY_KEYS.filter((k) => offers.some((o) => o.category === k));
  return (
    <>
      <div className="dir-tools">
        <label className="search">
          <Icon name="search" />
          <span className="sr">Chercher une offre</span>
          <input type="search" autoComplete="off" placeholder="Chercher : hammam, café, padel…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="chips-row" role="tablist" aria-label="Filtrer les offres">
        <button className={"fchip" + (cat === "tout" ? " on" : "")} role="tab" aria-selected={cat === "tout"} onClick={() => setCat("tout")}>
          Tout<small>{found.length}</small>
        </button>
        {cats.map((k) => (
          <button key={k} className={"fchip" + (cat === k ? " on" : "")} role="tab" aria-selected={cat === k} onClick={() => setCat(k)}>
            {CATEGORY_LABEL[k]}
            <small>{found.filter((o) => o.category === k).length}</small>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="offer-grid" key={cat}>
          {list.map((o, i) => (
            <Link key={o.id} href={`/espace/fiche/${o.orgSlug}#offre-${o.id}`} className="offer-card" style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}>
              <div className={"ph" + (o.photo ? "" : " noimg")}>{o.photo ? <EventImage image={o.photo} alt={o.orgName} /> : <NoImage label={o.orgName} />}</div>
              <span className="oc-badge">{o.badge}</span>
              <div className="oc-body">
                <span className="oc-org">{o.orgName}</span>
                <h3>{o.title}</h3>
                <p>{o.detail}</p>
                <div className="oc-foot">
                  <span>
                    <Icon name="pin" />
                    {o.area ?? "Marrakech"}
                  </span>
                  {o.audience === "premium" ? (
                    <span className="chip gold">
                      <Icon name="crown" />
                      Premium
                    </span>
                  ) : (
                    <span>{AUDIENCE_LABEL[o.audience] === AUDIENCE_LABEL.all ? "Toutes" : "Membres"}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="places-empty">Aucune offre ne correspond. Essaie une autre catégorie.</p>
      )}
    </>
  );
}
