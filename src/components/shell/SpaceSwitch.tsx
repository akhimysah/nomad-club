"use client";

import Link from "next/link";
import { useState } from "react";
import type { Space } from "@/lib/permissions";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { SPACES } from "./spaces";

/** Espaces privés (hors visiteuse) : le sélecteur n'apparaît que s'il y en a au moins deux. */
function privateSpaces(spaces: Space[]): Space[] {
  return spaces.filter((s) => s !== "visit");
}

/**
 * Mode réel : changer d'espace quand les rôles en ouvrent plusieurs (membre + partenaire + pro…).
 * Barre latérale (ordinateur). En démo, c'est le bandeau du haut qui joue ce rôle (liste vide).
 */
export function SpaceLinks({ spaces, current }: { spaces: Space[]; current: Space }) {
  const list = privateSpaces(spaces);
  if (list.length < 2) return null;
  return (
    <nav className="space-links" aria-label="Mes espaces">
      <div className="mini-h">Mes espaces</div>
      {list.map((s) => (
        <Link key={s} href={SPACES[s].home} className={"side-btn" + (s === current ? " on" : "")} aria-current={s === current ? "true" : undefined}>
          <Icon name={SPACES[s].icon} />
          {SPACES[s].label}
        </Link>
      ))}
    </nav>
  );
}

/** Même choix sur téléphone : bouton dans l'en-tête, qui ouvre une feuille. */
export function SpaceSheetButton({ spaces, current }: { spaces: Space[]; current: Space }) {
  const [open, setOpen] = useState(false);
  const list = privateSpaces(spaces);
  if (list.length < 2) return null;
  return (
    <>
      <button type="button" className="bell" aria-haspopup="dialog" aria-label="Changer d’espace" onClick={() => setOpen(true)}>
        <Icon name="swap" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Changer d’espace">
        <h2 className="sh-title">Mes espaces</h2>
        <p className="sh-sub">Ton compte ouvre plusieurs espaces.</p>
        {list.map((s) => (
          <Link key={s} href={SPACES[s].home} className={"space-opt" + (s === current ? " on" : "")} onClick={() => setOpen(false)}>
            <span className="so-ic">
              <Icon name={SPACES[s].icon} />
            </span>
            <span>
              <b>{SPACES[s].label}</b>
              <small>{SPACES[s].sub}</small>
            </span>
            <Icon name="check" className="chk" />
          </Link>
        ))}
      </Sheet>
    </>
  );
}
