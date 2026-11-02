"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Pastille qui glisse sous l'onglet actif de la barre du bas (téléphone).
 * Se place dans n'importe quelle `.tabbar` : elle suit `.tab.on`, et bouge dès l'appui
 * (avant même la navigation) avec une petite vibration sur Android.
 */
export function TabIndicator() {
  const ref = useRef<HTMLSpanElement>(null);
  // Onglet touché en attente de navigation : la pastille y reste jusqu'à ce qu'il devienne actif.
  const pending = useRef<{ tab: Element; at: number } | null>(null);
  const current = (bar: Element) => {
    const on = bar.querySelector(".tab.on");
    const p = pending.current;
    if (p && p.tab !== on && Date.now() - p.at < 4000 && bar.contains(p.tab)) return p.tab;
    pending.current = null;
    return on;
  };

  const place = (tab: Element | null, instant = false) => {
    const ind = ref.current;
    const bar = ind?.parentElement;
    if (!ind || !bar || !(tab instanceof HTMLElement)) {
      if (ind) ind.style.opacity = "0";
      return;
    }
    if (instant) ind.style.transition = "none";
    ind.style.width = tab.offsetWidth + "px";
    ind.style.transform = `translateX(${tab.offsetLeft}px)`;
    ind.style.opacity = "1";
    if (instant) {
      void ind.offsetWidth;
      ind.style.transition = "";
    }
  };

  // Position initiale sans animation, puis à chaque changement de l'onglet actif.
  useLayoutEffect(() => {
    const bar = ref.current?.parentElement;
    if (!bar) return;
    place(bar.querySelector(".tab.on"), true);
    const mo = new MutationObserver(() => place(current(bar)));
    mo.observe(bar, { subtree: true, attributes: true, attributeFilter: ["class"] });
    const ro = new ResizeObserver(() => place(current(bar), true));
    ro.observe(bar);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  // Réaction immédiate à l'appui.
  useEffect(() => {
    const bar = ref.current?.parentElement;
    if (!bar) return;
    const onDown = (e: PointerEvent) => {
      const tab = (e.target as Element).closest(".tab");
      if (!tab || !bar.contains(tab)) return;
      tab.setAttribute("data-pressed", "");
      if (!tab.classList.contains("on")) {
        pending.current = { tab, at: Date.now() };
        place(tab);
        try {
          navigator.vibrate?.(8);
        } catch {
          /* rien */
        }
      }
    };
    const onUp = () => bar.querySelectorAll(".tab[data-pressed]").forEach((t) => t.removeAttribute("data-pressed"));
    bar.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      bar.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return <span ref={ref} className="tab-ind" aria-hidden="true" />;
}
