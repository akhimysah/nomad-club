"use client";

import { useMemo, useState } from "react";
import { PLACE_FILTERS, type PlaceFilterKey } from "@/lib/content";
import { normalize } from "@/lib/format";
import { areaKey } from "@/lib/modules/partenaires/domain";
import type { Place } from "@/lib/types";
import { ProCard, type CarnetPro } from "../partenaires/ProCard";
import { Icon } from "../ui/Icon";
import { PlaceCard } from "./bits";

const inFilter = (p: Place, k: PlaceFilterKey) => k === "tout" || (k === "club" ? !!p.recommendedBy : p.categories.includes(k));
// Lot 3 : fiches des pros abonnées (catégorie du carnet, jamais « le club y était »)
const proInFilter = (p: CarnetPro, k: PlaceFilterKey) => k === "tout" || (k !== "club" && p.carnetCategory === k);

/** Carnet d'adresses : lieux du club + annuaire pratique + pros du réseau (Lot 3), filtrable par catégorie et quartier. */
export function Carnet({ places, pros = [], initial }: { places: Place[]; pros?: CarnetPro[]; initial: PlaceFilterKey }) {
  const [cat, setCat] = useState<PlaceFilterKey>(initial);
  const [q, setQ] = useState("");
  const [area, setArea] = useState("tous");

  const index = useMemo(() => places.map((p) => normalize([p.name, p.kind, p.area, p.note, p.address ?? "", ...p.tags].join(" "))), [places]);
  const proIndex = useMemo(() => pros.map((p) => normalize([p.name, p.category, p.area ?? "", p.description ?? "", p.memberDiscount ?? ""].join(" "))), [pros]);
  const areas = useMemo(() => {
    const keys = new Set([...places.map((p) => areaKey(p.area)), ...pros.map((p) => areaKey(p.area))]);
    return [...keys].sort((a, b) => (a === "Autres" ? 1 : b === "Autres" ? -1 : a.localeCompare(b, "fr")));
  }, [places, pros]);
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const inArea = (a: string | null) => area === "tous" || areaKey(a) === area;
  const found = places.filter((p, i) => terms.every((t) => index[i].includes(t)) && inArea(p.area));
  const foundPros = pros.filter((p, i) => terms.every((t) => proIndex[i].includes(t)) && inArea(p.area));
  const list = found.filter((p) => inFilter(p, cat));
  const proList = foundPros.filter((p) => proInFilter(p, cat)).sort((a, b) => Number(b.featured) - Number(a.featured));

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
        <div className="carnet-filters">
          <label>
            <span className="sr">Quartier</span>
            <select className="area-select" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="tous">Tous les quartiers</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="chips-row" role="tablist" aria-label="Filtrer le carnet">
        {PLACE_FILTERS.map((f) => {
          const n = found.filter((p) => inFilter(p, f.key)).length + foundPros.filter((p) => proInFilter(p, f.key)).length;
          if (!n && f.key !== "tout" && f.key !== cat) return null;
          return (
            <button key={f.key} className={"fchip" + (cat === f.key ? " on" : "")} role="tab" aria-selected={cat === f.key} onClick={() => choose(f.key)}>
              {f.label}
              <small>{n}</small>
            </button>
          );
        })}
      </div>
      {proList.length > 0 && (
        <>
          <div className="carnet-sec">Pros du réseau</div>
          <div className="places" key={"pros-" + cat + area}>
            {proList.map((p, i) => (
              <ProCard key={p.id} p={p} i={i} />
            ))}
          </div>
          {list.length > 0 && <div className="carnet-sec">Le carnet</div>}
        </>
      )}
      {list.length ? (
        <div className="places" key={cat + area}>
          {list.map((p, i) => (
            <PlaceCard key={p.id} p={p} i={i} />
          ))}
        </div>
      ) : (
        !proList.length && <p className="places-empty">Aucune adresse ne correspond. Essaie un autre mot, ou pose la question au salon.</p>
      )}
    </>
  );
}
