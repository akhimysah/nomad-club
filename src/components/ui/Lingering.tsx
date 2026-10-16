"use client";

import { Fragment, useEffect, useState } from "react";

const recentlyDone = new Map<string, number>();

/** À appeler quand une action réussit : la ligne reste visible (état « traité ») un court instant. */
export function markDone(key: string) {
  recentlyDone.set(key, Date.now());
}

function isRecent(key: string) {
  const t = recentlyDone.get(key);
  return t !== undefined && Date.now() - t < 2500;
}

export type LingerItem = { key: string; node: React.ReactNode };
type Ghost = { item: LingerItem; index: number };

/**
 * Liste dont les lignes traitées ne disparaissent pas d'un coup : quand les données se mettent à jour,
 * la ligne validée reste affichée en « Validé / Relancée / Publié » puis s'efface.
 */
export function Lingering({ items, empty }: { items: LingerItem[]; empty?: React.ReactNode }) {
  const [state, setState] = useState<{ items: LingerItem[]; ghosts: Ghost[] }>({ items, ghosts: [] });
  if (state.items !== items) {
    const cur = new Set(items.map((i) => i.key));
    const kept = state.ghosts.filter((g) => !cur.has(g.item.key));
    const fresh = state.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !cur.has(item.key) && isRecent(item.key) && !kept.some((g) => g.item.key === item.key));
    setState({ items, ghosts: [...kept, ...fresh] });
  }
  const ghostCount = state.ghosts.length;
  useEffect(() => {
    if (!ghostCount) return;
    const t = setTimeout(() => setState((s) => ({ ...s, ghosts: [] })), 1300);
    return () => clearTimeout(t);
  }, [ghostCount]);

  const merged = [...items];
  [...state.ghosts].sort((a, b) => a.index - b.index).forEach((g) => merged.splice(Math.min(g.index, merged.length), 0, g.item));
  if (!merged.length) return <>{empty}</>;
  return (
    <>
      {merged.map((m) => (
        <Fragment key={m.key}>{m.node}</Fragment>
      ))}
    </>
  );
}
