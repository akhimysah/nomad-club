"use client";

import { useMemo, useState } from "react";
import { PLACE_FILTERS, type PlaceFilterKey } from "@/lib/content";
import { normalize } from "@/lib/format";
import type { Place } from "@/lib/types";
import { Icon } from "../ui/Icon";
import { PlaceCard } from "./bits";

const inFilter = (p: Place, k: PlaceFilterKey) => k === "tout" || (k === "club" ? !!p.recommendedBy : p.categories.includes(k));

/** Carnet d'adresses : lieux du club + annuaire pratique, filtrable et cherchable. */
export function Carnet({ places, initial }: { places: Place[]; initial: PlaceFilterKey }) {
  const [cat, setCat] = useState<PlaceFilterKey>(initial);
  const [q, setQ] = useState("");

  const index = useMemo(() => places.map((p) => normalize([p.name, p.kind, p.area, p.note, p.address ?? "", ...p.tags].join(" "))), [places]);
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const found = places.filter((_, i) => terms.every((t) => index[i].includes(t)));
  const list = found.filter((p) => inFilter(p, cat));

  const choose = (k: PlaceFilterKey) => {
    setCat(k);
    try {
      window.history.replaceState(null, "", k === "tout" ? "/espace/carnet" : `/espace/carnet?filtre=${k}`);
    } catch {
      /* sans importance */
    }
  };
  return (
    <>
      <div className="dir-tools">
        <label className="search">
          <Icon name="search" />
          <span className="sr">Chercher une adresse</span>
          <input id="carnet-search" type="search" autoComplete="off" placeholder="Chercher : pédiatre, rooftop, Guéliz…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="chips-row" role="tablist" aria-label="Filtrer le carnet">
        {PLACE_FILTERS.map((f) => {
          const n = found.filter((p) => inFilter(p, f.key)).length;
          if (!n && f.key !== "tout" && f.key !== cat) return null;
          return (
            <button key={f.key} className={"fchip" + (cat === f.key ? " on" : "")} role="tab" aria-selected={cat === f.key} onClick={() => choose(f.key)}>
              {f.label}
              <small>{n}</small>
            </button>
          );
        })}
      </div>
      {list.length ? (
        <div className="places" key={cat}>
          {list.map((p, i) => (
            <PlaceCard key={p.id} p={p} i={i} />
          ))}
        </div>
      ) : (
        <p className="places-empty">Aucune adresse ne correspond. Essaie un autre mot, ou pose la question au salon.</p>
      )}
    </>
  );
}
