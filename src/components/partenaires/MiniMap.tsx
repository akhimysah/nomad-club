"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import type { MapPin } from "./MapExplorer";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading: () => <div className="map-msg">Chargement de la carte…</div> });

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Petite carte de la fiche établissement (repli : l'adresse suffit). */
export function MiniMap({ pin, fallback }: { pin: MapPin; fallback: string }) {
  const [failed, setFailed] = useState(false);
  const msg = <div className="map-msg">{fallback}</div>;
  return (
    <div className="mini-map map-box" style={{ height: 220, minHeight: 0 }}>
      {failed ? (
        msg
      ) : (
        <Boundary fallback={msg}>
          <LeafletMap pins={[pin]} selected={null} zoom={15} center={[pin.lat, pin.lng]} onTilesFailed={() => setFailed(true)} />
        </Boundary>
      )}
    </div>
  );
}
