"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const EDGE = 26; // largeur de la zone de départ, depuis le bord gauche
const TRIGGER = 96; // distance à parcourir pour revenir

/**
 * Glisser depuis le bord gauche pour revenir en arrière (pages de détail, téléphone),
 * comme dans une appli iPhone : l'écran suit le doigt, puis part ou revient.
 * `base` : préfixe de l'espace (ex. « /espace ») ; le geste n'existe qu'à partir de deux niveaux.
 */
export function SwipeBack({ base }: { base: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const depth = pathname.slice(base.length).split("/").filter(Boolean).length;
  const enabled = depth >= 2;

  useEffect(() => {
    if (!enabled || !window.matchMedia("(max-width: 760px)").matches) return;
    let el: HTMLElement | null = null;
    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let locked: "x" | "y" | null = null;

    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      el = document.querySelector<HTMLElement>(".mscreen.on, .fscreen.on");
      if (!el) return;
      x0 = t.clientX;
      y0 = t.clientY;
      dx = 0;
      locked = null;
    };
    const move = (e: TouchEvent) => {
      if (!el) return;
      const t = e.touches[0];
      const mx = t.clientX - x0;
      const my = t.clientY - y0;
      if (!locked) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        locked = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (locked === "y") {
          el = null;
          return;
        }
        el.style.transition = "none";
        el.style.willChange = "transform";
      }
      dx = Math.max(0, mx);
      el.style.transform = `translateX(${dx}px)`;
      el.style.boxShadow = "-24px 0 48px -12px rgba(0,0,0,.6)";
      el.style.opacity = String(1 - Math.min(0.35, dx / 900));
    };
    const end = () => {
      if (!el || locked !== "x") {
        el = null;
        return;
      }
      const screen = el;
      el = null;
      screen.style.transition = "transform .32s cubic-bezier(.2,.8,.2,1), opacity .32s";
      if (dx > TRIGGER) {
        screen.style.transform = "translateX(100%)";
        screen.style.opacity = "0.4";
        try {
          navigator.vibrate?.(6);
        } catch {
          /* rien */
        }
        setTimeout(() => {
          const parent = pathname.split("/").slice(0, -1).join("/") || base;
          if (window.history.length > 1) router.back();
          else router.push(parent);
          // L'écran suivant prend la place ; on nettoie au cas où le même élément serait réutilisé.
          setTimeout(() => {
            for (const p of ["transform", "opacity", "box-shadow", "transition", "will-change"]) screen.style.removeProperty(p);
          }, 400);
        }, 220);
      } else {
        screen.style.transform = "";
        screen.style.opacity = "";
        screen.style.boxShadow = "";
        setTimeout(() => {
          screen.style.transition = "";
          screen.style.willChange = "";
        }, 340);
      }
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, [enabled, pathname, router, base]);

  return null;
}
