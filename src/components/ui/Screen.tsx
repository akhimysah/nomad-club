"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

const lastIndex: Record<string, number> = {};

/**
 * Écran d'un espace : glisse depuis la droite ou la gauche selon l'onglet précédent (comme la maquette).
 * `mobileOnly` : l'animation ne joue que sur téléphone (espace Compte gratuit).
 */
export function Screen({
  group,
  index,
  className,
  mobileOnly,
  children,
  style,
  id,
}: {
  group: string;
  index: number;
  className: string;
  mobileOnly?: boolean;
  children: React.ReactNode;
  style?: CSSProperties;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const prev = lastIndex[group];
    lastIndex[group] = index;
    if (!el || prev === undefined || prev === index) return;
    if (mobileOnly && !window.matchMedia("(max-width: 760px)").matches) return;
    el.style.setProperty("--dir", index >= prev ? "1" : "-1");
    el.classList.remove("screen-in");
    void el.offsetWidth;
    el.classList.add("screen-in");
  }, [group, index, mobileOnly]);
  return (
    <div ref={ref} className={className} style={style} id={id}>
      {children}
    </div>
  );
}
