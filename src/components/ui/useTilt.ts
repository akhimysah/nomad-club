"use client";

import { useEffect, useRef } from "react";

/** Inclinaison 3D et reflet qui suit le doigt ou la souris (billet, carte de membre). */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = (e: PointerEvent) => {
      if (reduced) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      el.classList.add("tilting");
      el.style.setProperty("--ry", ((x - 0.5) * 22).toFixed(2) + "deg");
      el.style.setProperty("--rx", ((0.5 - y) * 16).toFixed(2) + "deg");
      el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    };
    const leave = () => {
      el.classList.remove("tilting");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") leave();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointercancel", leave);
      el.removeEventListener("pointerup", up);
    };
  }, []);
  return ref;
}
