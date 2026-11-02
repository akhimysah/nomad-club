"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSegmentAction, saveSegmentAction } from "@/app/actions/crm";
import { filterToQuery } from "@/lib/modules/crm/domain";
import type { ContactFilter } from "@/lib/modules/crm/types";
import { Sheet } from "../ui/Sheet";
import { useRun } from "./useRun";

/** Enregistre les filtres en cours comme segment (ou renomme un segment existant). */
export function SaveSegmentButton({ filters, segment, label }: { filters: ContactFilter; segment?: { id: string; name: string; description: string | null }; label?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const { run, busy } = useRun();
  const router = useRouter();
  return (
    <>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpen(true)}>
        {label ?? "Enregistrer comme segment"}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Segment">
        <form
          className="crm"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveSegmentAction({ name, description, filters }, segment?.id ?? null), {
              onOk: (r) => {
                setOpen(false);
                if (!segment && r.id) router.push(`/fondatrices/crm/contacts?${filterToQuery(filters)}&seg=${r.id}`);
              },
            });
          }}
        >
          <h2 style={{ font: "500 26px/1.15 var(--serif)", margin: "0 0 14px" }}>{segment ? "Modifier le segment" : "Nouveau segment"}</h2>
          <label className="cf" style={{ marginBottom: 10 }}>
            <span>Nom</span>
            <input className="ci" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Prospects du lancement de saison" maxLength={80} required />
          </label>
          <label className="cf" style={{ marginBottom: 14 }}>
            <span>Description (facultatif)</span>
            <input className="ci" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} />
          </label>
          <button className="btn btn-ink btn-sm" disabled={busy || !name.trim()}>
            Enregistrer
          </button>
        </form>
      </Sheet>
    </>
  );
}

export function DeleteSegmentButton({ id, name }: { id: string; name: string }) {
  const { run, busy } = useRun();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      disabled={busy}
      onClick={() => {
        if (window.confirm(`Supprimer le segment « ${name} » ? Les contacts ne sont pas touchés.`)) run(() => deleteSegmentAction(id));
      }}
    >
      Supprimer
    </button>
  );
}
