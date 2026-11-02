"use client";

import { useActionState, useState } from "react";
import { saveLocationAction, stopSharingAction, type FormState } from "@/app/actions/partenaires";
import type { LocationDisplay, LocationPrecision } from "@/lib/modules/partenaires/types";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export type LocationFormValue = { sharing: boolean; precision: LocationPrecision; display: LocationDisplay; area: string | null; consentedAt: string | null };

/**
 * Réglages de position sur la carte : consentement explicite, désactivable à tout moment,
 * position APPROXIMATIVE (quartier ou point arrondi à ~500 m), choix d'apparaître avec son prénom ou anonymement.
 */
export function LocationForm({ value, areas }: { value: LocationFormValue; areas: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLocationAction, null);
  const [sharing, setSharing] = useState(value.sharing);
  const [precision, setPrecision] = useState<LocationPrecision>(value.precision);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const toast = useToast();

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoMsg("Ton navigateur ne donne pas la position : on utilisera le centre du quartier.");
      return;
    }
    setGeoMsg("Recherche de ta position…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoMsg("Position trouvée : elle sera arrondie à ~500 m avant d’être enregistrée.");
      },
      () => setGeoMsg("Position refusée : on utilisera le centre du quartier."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const stop = async () => {
    setStopping(true);
    const r = await stopSharingAction();
    setStopping(false);
    setSharing(false);
    if (r) toast(r.message, r.ok ? "check" : "bell");
  };

  return (
    <form action={action} className="card loc-card p-form">
      <div className="card-h">
        <h2 className="h-sm">Ma position sur la carte</h2>
        <span className={value.sharing ? "chip solid" : "chip"}>{value.sharing ? "Partagée" : "Non partagée"}</span>
      </div>
      {state && (
        <div className={"form-msg" + (state.ok ? "" : " err")} role="status">
          <Icon name={state.ok ? "check" : "bell"} />
          {state.message}
        </div>
      )}
      <div className="switch-row">
        <span>
          <b>Apparaître sur la carte des membres</b>
          <span>Jamais ta position exacte : ton quartier, ou un point arrondi à ~500 m.</span>
        </span>
        <input className="pref-switch" type="checkbox" name="sharing" checked={sharing} onChange={(e) => setSharing(e.target.checked)} aria-label="Partager ma position" />
      </div>
      {sharing && (
        <>
          <div className="field">
            <label htmlFor="loc-area">Mon quartier</label>
            <select id="loc-area" name="area" defaultValue={value.area ?? ""} required>
              <option value="" disabled>
                Choisir…
              </option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {state?.errors?.area && <span className="err">{state.errors.area}</span>}
          </div>
          <div className="mini-h">Précision</div>
          <div className="loc-opts">
            <label className="loc-opt">
              <input type="radio" name="precision" value="area" checked={precision === "area"} onChange={() => setPrecision("area")} />
              <span>
                <b>Quartier seulement</b>
                Un point au centre du quartier.
              </span>
            </label>
            <label className="loc-opt">
              <input type="radio" name="precision" value="approx" checked={precision === "approx"} onChange={() => setPrecision("approx")} />
              <span>
                <b>Environ 500 m</b>
                Ta position, arrondie avant d’être enregistrée.
              </span>
            </label>
          </div>
          {precision === "approx" && (
            <div style={{ marginBottom: 16 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={locate}>
                <Icon name="pin" />
                Utiliser ma position actuelle
              </button>
              {geoMsg && <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>{geoMsg}</p>}
              <input type="hidden" name="lat" value={geo?.lat ?? ""} />
              <input type="hidden" name="lng" value={geo?.lng ?? ""} />
            </div>
          )}
          <div className="mini-h">Visibilité</div>
          <div className="loc-opts">
            <label className="loc-opt">
              <input type="radio" name="display" value="name" defaultChecked={value.display === "name"} />
              <span>
                <b>Avec mon prénom</b>
                Prénom, initiale et métier ; les membres peuvent t’écrire.
              </span>
            </label>
            <label className="loc-opt">
              <input type="radio" name="display" value="anonymous" defaultChecked={value.display === "anonymous"} />
              <span>
                <b>Anonyme</b>
                « Une membre » dans ce quartier, sans nom.
              </span>
            </label>
          </div>
          <label className="consent">
            <input type="checkbox" name="consent" defaultChecked={value.sharing} required />
            <span>
              J’accepte que ma position approximative soit visible par les membres du club connectées. Je peux la retirer à tout moment ; elle est alors effacée.
            </span>
          </label>
          {state?.errors?.consent && <p className="form-msg err">{state.errors.consent}</p>}
        </>
      )}
      <div className="btn-row">
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
          <Icon name="check" />
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {value.sharing && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={stop} disabled={stopping}>
            <Icon name="x" />
            Ne plus partager
          </button>
        )}
      </div>
      {value.consentedAt && value.sharing && (
        <p className="muted" style={{ fontSize: 13.5, margin: "12px 0 0" }}>
          Consentement donné le {new Date(value.consentedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      )}
    </form>
  );
}
