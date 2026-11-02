"use client";

import { mergeContactsAction } from "@/app/actions/crm";
import { useRun } from "./useRun";

export function MergePair({ keepId, dropId, label }: { keepId: string; dropId: string; label: string }) {
  const { run, busy } = useRun();
  return (
    <button
      type="button"
      className="btn btn-ink btn-xs"
      disabled={busy}
      onClick={() => {
        if (window.confirm("Fusionner ces deux fiches ? Les échanges, tâches et opportunités sont repris, la fiche en double est supprimée.")) run(() => mergeContactsAction(keepId, dropId));
      }}
    >
      {busy ? <span className="spin" /> : null}
      {label}
    </button>
  );
}
