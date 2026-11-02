"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SCREENS = ".mscreen, .fscreen";

/**
 * Suit le défilement de l'écran actif et le signale sur <html> :
 * - data-scrolled : l'en-tête passe en verre dépoli avec un filet ;
 * - data-past-title : le grand titre est sorti de l'écran, le petit titre apparaît dans l'en-tête.
 */
export function ScrollChrome() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const apply = (el: Element | null) => {
      const top = el instanceof HTMLElement ? el.scrollTop : 0;
      const title = el?.querySelector(".scr-title");
      const limit = title instanceof HTMLElement ? title.offsetTop + title.offsetHeight - 8 : 48;
      root.toggleAttribute("data-scrolled", top > 6);
      root.toggleAttribute("data-past-title", top > limit);
    };
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target.closest(SCREENS) : null;
      if (!el || e.target !== el) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apply(el));
    };
    // Nouvel écran : on repart du haut.
    apply(document.querySelector(".mscreen.on, .fscreen.on"));
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [pathname]);

  return null;
}
