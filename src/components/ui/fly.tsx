"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type FlySource = { src: string; rect: DOMRect; radius: string; at: number };

let pending: FlySource | null = null;
let navCount = 0;

/** Source de l'animation « la photo s'envole vers le détail », relevée au clic. */
export function takeFly(): FlySource | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < 4000 ? p : null;
}

/** Vrai si on peut revenir en arrière dans l'appli (sinon on renvoie vers la liste). */
export function canGoBack(): boolean {
  return navCount > 1;
}

/** Écoute les clics sur les liens [data-fly] et compte les navigations internes. */
export function FlyCatcher() {
  const pathname = usePathname();
  useEffect(() => {
    navCount++;
  }, [pathname]);
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[data-fly]");
      if (!a) return;
      const img = a.querySelector("img");
      if (!img) return;
      const holder = img.closest(".ph,.feature,.big-ev,.nc-ph") ?? img;
      pending = { src: img.currentSrc || img.src, rect: img.getBoundingClientRect(), radius: getComputedStyle(holder).borderRadius || "20px", at: Date.now() };
    };
    document.addEventListener("click", on, true);
    return () => document.removeEventListener("click", on, true);
  }, []);
  return null;
}

/** Anime une copie de la photo depuis la carte cliquée jusqu'à sa place dans le détail. */
export function flyTo(source: FlySource, dst: HTMLImageElement, done: () => void) {
  const a = source.rect;
  const b = dst.getBoundingClientRect();
  if (!a.width || !b.width) return done();
  const c = document.createElement("img");
  c.src = source.src;
  c.className = "fly";
  c.alt = "";
  c.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;border-radius:${source.radius};object-position:${getComputedStyle(dst).objectPosition}`;
  document.body.appendChild(c);
  const an = c.animate(
    [
      { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", borderRadius: source.radius },
      { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px", borderRadius: "0px" },
    ],
    { duration: 620, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
  );
  let fin = false;
  const end = () => {
    if (fin) return;
    fin = true;
    done();
    setTimeout(() => c.remove(), 30);
  };
  an.onfinish = end;
  setTimeout(end, 700);
}
