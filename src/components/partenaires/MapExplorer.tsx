"use client";

import dynamic from "next/dynamic";
import { Component, useMemo, useState, type ReactNode } from "react";
import { CATEGORY_KEYS, CATEGORY_LABEL } from "@/lib/modules/partenaires/domain";
import type { PlaceCategory } from "@/lib/types";
import { Icon } from "../ui/Icon";

export type MapPin = {
  id: string;
  kind: "partner" | "pro" | "member";
  lat: number;
  lng: number;
  /** Petite ligne au-dessus du titre (catégorie, « Membre »…). */
  kicker: string;
  title: string;
  subtitle: string;
  category: PlaceCategory | null;
  href: string | null;
};

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="map-msg">Chargement de la carte…</div>,
});

/** Si la bibliothèque de carte ne se charge pas, on affiche la liste à la place (repli). */
class MapBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const KIND_LABEL = { partner: "Offres", pro: "Pros", member: "Membres" } as const;

/** Carte interactive : filtres, marqueurs, fiche au clic, liste synchronisée (et repli si la carte ne charge pas). */
export function MapExplorer({ pins }: { pins: MapPin[] }) {
  const [cat, setCat] = useState<PlaceCategory | "tout">("tout");
  const [kinds, setKinds] = useState<Record<MapPin["kind"], boolean>>({ partner: true, pro: true, member: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [listOnly, setListOnly] = useState(false);
  const visible = useMemo(() => pins.filter((p) => kinds[p.kind] && (cat === "tout" || p.kind === "member" || p.category === cat)), [pins, kinds, cat]);
  const cats = CATEGORY_KEYS.filter((k) => pins.some((p) => p.category === k));
  const showList = failed || listOnly;
  const places = visible.filter((p) => p.kind !== "member");
  const members = visible.filter((p) => p.kind === "member");
  return (
    <>
      <div className="map-toggles">
        {(Object.keys(KIND_LABEL) as MapPin["kind"][]).map((k) => (
          <button key={k} type="button" className={"fchip" + (kinds[k] ? " on" : "")} aria-pressed={kinds[k]} onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}>
            {KIND_LABEL[k]}
            <small>{pins.filter((p) => p.kind === k).length}</small>
          </button>
        ))}
        {!failed && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setListOnly((v) => !v)} style={{ marginLeft: "auto" }}>
            <Icon name={listOnly ? "pin" : "grid"} />
            {listOnly ? "Voir la carte" : "Voir en liste"}
          </button>
        )}
      </div>
      <div className="chips-row" role="tablist" aria-label="Filtrer par catégorie" style={{ marginBottom: 16 }}>
        <button className={"fchip" + (cat === "tout" ? " on" : "")} role="tab" aria-selected={cat === "tout"} onClick={() => setCat("tout")}>
          Toutes les catégories
        </button>
        {cats.map((k) => (
          <button key={k} className={"fchip" + (cat === k ? " on" : "")} role="tab" aria-selected={cat === k} onClick={() => setCat(k)}>
            {CATEGORY_LABEL[k]}
          </button>
        ))}
      </div>
      {failed && (
        <p className="rule" style={{ marginBottom: 16 }}>
          <Icon name="globe" />
          <span>La carte ne se charge pas (connexion ou bloqueur). Voici la liste des adresses et des membres à proximité.</span>
        </p>
      )}
      <div className="map-layout" style={showList ? { gridTemplateColumns: "1fr" } : undefined}>
        {!showList && (
          <div className="map-box" aria-label="Carte de Marrakech">
            <MapBoundary onError={() => setFailed(true)}>
              <LeafletMap pins={visible} selected={selected} onSelect={setSelected} onTilesFailed={() => setFailed(true)} />
            </MapBoundary>
          </div>
        )}
        <div className="map-side" aria-label="Liste des lieux">
          {places.map((p) => (
            <button key={p.id} type="button" className={"map-item" + (selected === p.id ? " on" : "")} onClick={() => (showList && p.href ? (window.location.href = p.href) : setSelected(p.id))}>
              <span className={"mk " + p.kind}>
                <i>{p.kind === "partner" ? "%" : "P"}</i>
              </span>
              <span>
                <b>{p.title}</b>
                <span>
                  {p.kicker} · {p.subtitle}
                </span>
              </span>
            </button>
          ))}
          {members.length > 0 && (
            <div className="mini-h" style={{ margin: "8px 0 0" }}>
              Membres à proximité ({members.length})
            </div>
          )}
          {members.map((p) => (
            <button key={p.id} type="button" className={"map-item" + (selected === p.id ? " on" : "")} onClick={() => (showList && p.href ? (window.location.href = p.href) : setSelected(p.id))}>
              <span className="mk member">
                <i />
              </span>
              <span>
                <b>{p.title}</b>
                <span>{p.subtitle}</span>
              </span>
            </button>
          ))}
          {!visible.length && <div className="empty">Rien à afficher avec ces filtres.</div>}
        </div>
      </div>
      <div className="map-legend">
        <span>
          <span className="mk partner">
            <i>%</i>
          </span>
          Partenaire (offres)
        </span>
        <span>
          <span className="mk pro">
            <i>P</i>
          </span>
          Pro du réseau
        </span>
        <span>
          <span className="mk member">
            <i />
          </span>
          Membre (position approximative, ~500 m ou quartier)
        </span>
      </div>
    </>
  );
}
