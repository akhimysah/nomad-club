"use client";

/**
 * Carte Leaflet + tuiles OpenStreetMap. Chargée uniquement côté navigateur (next/dynamic, ssr: false).
 * Marqueurs en divIcon noir et blanc : établissements partenaires, pros du carnet, membres (cercle approximatif).
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapPin } from "./MapExplorer";

const CENTER: [number, number] = [31.6295, -8.008];
const GLYPH = { partner: "%", pro: "P", member: "" } as const;

function icon(kind: MapPin["kind"], on: boolean): L.DivIcon {
  const size = kind === "member" ? 22 : on ? 38 : 30;
  return L.divIcon({
    className: "nc-marker",
    html: `<span class="mk ${kind}" style="width:${size}px;height:${size}px"><i>${GLYPH[kind]}</i></span>`,
    iconSize: [size, size],
    iconAnchor: kind === "member" ? [size / 2, size / 2] : [size / 2, size],
    popupAnchor: [0, kind === "member" ? -size / 2 : -size],
  });
}

function Focus({ pin, markers }: { pin: MapPin | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!pin) return;
    map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    const t = setTimeout(() => markers.current?.get(pin.id)?.openPopup(), 650);
    return () => clearTimeout(t);
  }, [pin, map, markers]);
  return null;
}

export default function LeafletMap({
  pins,
  selected,
  onSelect,
  onTilesFailed,
  zoom = 13,
  center,
}: {
  pins: MapPin[];
  selected: string | null;
  onSelect?: (id: string) => void;
  onTilesFailed?: () => void;
  zoom?: number;
  center?: [number, number];
}) {
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const errors = useRef(0);
  const loaded = useRef(0);
  const pin = useMemo(() => pins.find((p) => p.id === selected) ?? null, [pins, selected]);
  return (
    <MapContainer center={center ?? CENTER} zoom={zoom} scrollWheelZoom={false} style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={18}
        eventHandlers={{
          tileload: () => {
            loaded.current++;
          },
          tileerror: () => {
            errors.current++;
            // rien n'a chargé et plusieurs tuiles échouent : on bascule sur la liste
            if (errors.current >= 4 && loaded.current === 0) onTilesFailed?.();
          },
        }}
      />
      {pins.map((p) =>
        p.kind === "member" ? (
          <Circle key={p.id + "-c"} center={[p.lat, p.lng]} radius={450} pathOptions={{ color: "#111", weight: 1, opacity: 0.35, fillOpacity: 0.06 }} />
        ) : null,
      )}
      {pins.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={icon(p.kind, p.id === selected)}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
          ref={(m) => {
            if (m) markers.current.set(p.id, m);
            else markers.current.delete(p.id);
          }}
        >
          <Popup>
            <span className="pk">{p.kicker}</span>
            <b>{p.title}</b>
            {p.subtitle}
            {p.href && (
              <>
                <br />
                <a className="pl" href={p.href}>
                  {p.kind === "member" ? "Lui écrire" : "Voir la fiche"}
                </a>
              </>
            )}
          </Popup>
        </Marker>
      ))}
      <Focus pin={pin} markers={markers} />
    </MapContainer>
  );
}
