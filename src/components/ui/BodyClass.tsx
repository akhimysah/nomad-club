"use client";

import { useEffect } from "react";

/** Ajoute une classe au <body> tant que le composant est affiché (ex. « is-day » chez les fondatrices). */
export function BodyClass({ name }: { name: string }) {
  useEffect(() => {
    document.body.classList.add(name);
    return () => document.body.classList.remove(name);
  }, [name]);
  return null;
}
