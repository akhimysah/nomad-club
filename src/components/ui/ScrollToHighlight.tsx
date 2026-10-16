"use client";

import { useEffect } from "react";

/** Fait défiler jusqu'à l'élément mis en avant (.new-hl), par exemple un brouillon tout juste créé. */
export function ScrollToHighlight({ token }: { token?: string }) {
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector(".new-hl")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, [token]);
  return null;
}
