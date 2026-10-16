"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { publishDraftAction, saveEventAction } from "@/app/actions/founders";
import type { EventForm } from "@/lib/validation";
import { Icon } from "../ui/Icon";
import { markDone } from "../ui/Lingering";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";

export type PlaceOption = { id: string; name: string };
export type EditableEvent = {
  id: string;
  title: string;
  status: "draft" | "published" | "cancelled";
  date: string;
  time: string;
  endTime: string;
  placeId: string;
  capacity: number;
  pricePublic: number;
  priceMember: number;
  premiumFree: boolean;
  description: string;
};
type DraftRef = { id: string; title: string; date: string };

type Ui = { newEvent: () => void; editEvent: (e: EditableEvent) => void; choosePlace: (d: DraftRef) => void };
const Ctx = createContext<Ui>({ newEvent: () => {}, editEvent: () => {}, choosePlace: () => {} });
export const useFounderUi = () => useContext(Ctx);

function EventFormSheet({ initial, places, minDate, onClose }: { initial: EditableEvent | null; places: PlaceOption[]; minDate: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<EventForm & { premiumFree: boolean }>(() =>
    initial
      ? { title: initial.title, date: initial.date, time: initial.time, endTime: initial.endTime, placeId: initial.placeId, capacity: initial.capacity, pricePublic: initial.pricePublic, priceMember: initial.priceMember, premiumFree: initial.premiumFree, description: initial.description }
      : { title: "", date: "2026-12-05", time: "11:00", endTime: "", placeId: "", capacity: 12, pricePublic: 60, priceMember: 50, premiumFree: false, description: "" },
  );
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = (k: string) => (err?.field === k ? err.msg : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (String(f.title).trim().length < 3) return setErr({ field: "title", msg: "Donnez un titre à l’événement." });
    setBusy(true);
    const r = await saveEventAction(f, initial?.id);
    setBusy(false);
    if (!r.ok) return setErr({ field: r.field, msg: r.error });
    onClose();
    toast(r.created ? `Brouillon « ${r.title} » créé` : `« ${r.title} » est mis à jour`, "edit");
    router.push(`/fondatrices/evenements?nouveau=${encodeURIComponent(r.id)}`);
  };

  return (
    <>
      <div className="eyebrow">{initial ? (initial.status === "draft" ? "Brouillon" : "Rendez-vous publié") : "Nouvel événement"}</div>
      <h2 className="sh-title">{initial ? "Modifier" : "Créer un brouillon"}</h2>
      <p className="sh-sub">{initial ? "Les changements sont visibles tout de suite." : "Il reste en brouillon tant que vous ne le publiez pas."}</p>
      {err && !err.field && (
        <div className="flash">
          <Icon name="bell" />
          {err.msg}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className={"field" + (fe("title") ? " err" : "")}>
          <label htmlFor="ne-title">Titre</label>
          <input id="ne-title" placeholder="Ex. Atelier céramique" value={String(f.title)} onChange={(e) => set("title", e.target.value)} />
          <span className="err-msg">{fe("title")}</span>
        </div>
        <div className="field-row">
          <div className={"field" + (fe("date") ? " err" : "")}>
            <label htmlFor="ne-date">Date</label>
            <input id="ne-date" type="date" value={String(f.date)} min={initial ? undefined : minDate} onChange={(e) => set("date", e.target.value)} />
            <span className="err-msg">{fe("date")}</span>
          </div>
          <div className={"field" + (fe("time") ? " err" : "")}>
            <label htmlFor="ne-time">Heure</label>
            <input id="ne-time" type="time" value={String(f.time)} onChange={(e) => set("time", e.target.value)} />
            <span className="err-msg">{fe("time")}</span>
          </div>
        </div>
        <div className="field-row">
          <div className={"field" + (fe("placeId") ? " err" : "")}>
            <label htmlFor="ne-place">Lieu</label>
            <select id="ne-place" value={String(f.placeId ?? "")} onChange={(e) => set("placeId", e.target.value)}>
              <option value="">À confirmer</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="err-msg">{fe("placeId")}</span>
          </div>
          <div className={"field" + (fe("endTime") ? " err" : "")}>
            <label htmlFor="ne-end">Fin (facultatif)</label>
            <input id="ne-end" type="time" value={String(f.endTime ?? "")} onChange={(e) => set("endTime", e.target.value)} />
            <span className="err-msg">{fe("endTime")}</span>
          </div>
        </div>
        <div className="field-row">
          <div className={"field" + (fe("capacity") ? " err" : "")}>
            <label htmlFor="ne-seats">Places</label>
            <input id="ne-seats" type="number" inputMode="numeric" min={2} value={Number(f.capacity)} onChange={(e) => set("capacity", Number(e.target.value))} />
            <span className="err-msg">{fe("capacity")}</span>
          </div>
          <div className="field">
            <label htmlFor="ne-pub">Prix public ($)</label>
            <input id="ne-pub" type="number" inputMode="numeric" min={0} disabled={f.premiumFree} value={Number(f.pricePublic)} onChange={(e) => set("pricePublic", Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ne-mem">Prix adhérentes ($)</label>
          <input id="ne-mem" type="number" inputMode="numeric" min={0} disabled={f.premiumFree} value={Number(f.priceMember)} onChange={(e) => set("priceMember", Number(e.target.value))} />
        </div>
        <label className="toggle" htmlFor="ne-premium">
          <span>Réservé aux Premium, offert</span>
          <input type="checkbox" id="ne-premium" checked={f.premiumFree} onChange={(e) => set("premiumFree", e.target.checked)} />
        </label>
        <div className="field">
          <label htmlFor="ne-desc">Description</label>
          <textarea id="ne-desc" placeholder="Quelques mots pour donner envie" value={String(f.description ?? "")} onChange={(e) => set("description", e.target.value)} />
        </div>
        <button className="btn btn-ink btn-block" type="submit" disabled={busy}>
          {busy ? <span className="spin" /> : <Icon name={initial ? "check" : "plus"} />}
          {initial ? "Enregistrer" : "Créer le brouillon"}
        </button>
      </form>
    </>
  );
}

function PlaceSheet({ draft, places, onClose }: { draft: DraftRef; places: PlaceOption[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [placeId, setPlaceId] = useState(places.find((p) => p.name === "AVABAY")?.id ?? places[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="eyebrow">Brouillon</div>
      <h2 className="sh-title">{draft.title}</h2>
      <p className="sh-sub">{draft.date}. Choisissez le lieu, puis publiez.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          markDone(`draft:${draft.id}`);
          const r = await publishDraftAction(draft.id, placeId);
          setBusy(false);
          onClose();
          toast(r.ok ? r.message : r.error, r.ok ? "cal" : "bell");
          router.refresh();
        }}
      >
        <div className="field">
          <label htmlFor="pl-select">Lieu</label>
          <select id="pl-select" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-ink btn-block" type="submit" disabled={busy}>
          {busy && <span className="spin" />}
          Enregistrer et publier
        </button>
      </form>
    </>
  );
}

/** Feuilles des fondatrices (nouvel événement, modification, choix du lieu) partagées par tous les écrans. */
export function FounderHost({ places, minDate, children }: { places: PlaceOption[]; minDate: string; children: React.ReactNode }) {
  const [sheet, setSheet] = useState<{ kind: "new" } | { kind: "edit"; e: EditableEvent } | { kind: "place"; d: DraftRef } | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const show = (s: NonNullable<typeof sheet>) => {
    setSheet(s);
    setKey((k) => k + 1);
    setOpen(true);
  };
  const ui: Ui = { newEvent: () => show({ kind: "new" }), editEvent: (e) => show({ kind: "edit", e }), choosePlace: (d) => show({ kind: "place", d }) };
  return (
    <Ctx.Provider value={ui}>
      {children}
      <Sheet open={open} onClose={() => setOpen(false)} label="Événement">
        {sheet?.kind === "new" && <EventFormSheet key={key} initial={null} places={places} minDate={minDate} onClose={() => setOpen(false)} />}
        {sheet?.kind === "edit" && <EventFormSheet key={key} initial={sheet.e} places={places} minDate={minDate} onClose={() => setOpen(false)} />}
        {sheet?.kind === "place" && <PlaceSheet key={key} draft={sheet.d} places={places} onClose={() => setOpen(false)} />}
      </Sheet>
    </Ctx.Provider>
  );
}

export function NewEventButton({ className, label }: { className: string; label: string }) {
  const ui = useFounderUi();
  return (
    <button className={className} onClick={ui.newEvent}>
      <Icon name="plus" />
      {label}
    </button>
  );
}

export function EditEventButton({ e, className = "btn btn-ghost btn-xs" }: { e: EditableEvent; className?: string }) {
  const ui = useFounderUi();
  return (
    <button className={className} onClick={() => ui.editEvent(e)}>
      <Icon name="edit" />
      Modifier
    </button>
  );
}

export function ChoosePlaceButton({ d }: { d: DraftRef }) {
  const ui = useFounderUi();
  return (
    <button className="btn btn-ink btn-xs" onClick={() => ui.choosePlace(d)}>
      Choisir le lieu
    </button>
  );
}
