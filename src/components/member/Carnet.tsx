"use client";

import { useState } from "react";
import { PLACE_FILTERS, type PlaceFilterKey } from "@/lib/content";
import type { Place } from "@/lib/types";
import { PlaceCard } from "./bits";

/** Carnet d'adresses filtrable (Tout, Manger, Sortir, Bien-être et sport, En famille). */
export function Carnet({ places, initial }: { places: Place[]; initial: PlaceFilterKey }) {
  const [cat, setCat] = useState<PlaceFilterKey>(initial);
  const list = places.filter((p) => cat === "tout" || p.categories.includes(cat));
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
      <div className="chips-row" role="tablist" aria-label="Filtrer le carnet">
        {PLACE_FILTERS.map((f) => {
          const n = f.key === "tout" ? places.length : places.filter((p) => p.categories.includes(f.key)).length;
          return (
            <button key={f.key} className={"fchip" + (cat === f.key ? " on" : "")} role="tab" aria-selected={cat === f.key} onClick={() => choose(f.key)}>
              {f.label}
              <small>{n}</small>
            </button>
          );
        })}
      </div>
      <div className="places" key={cat}>
        {list.map((p, i) => (
          <PlaceCard key={p.id} p={p} i={i} />
        ))}
      </div>
    </>
  );
}
