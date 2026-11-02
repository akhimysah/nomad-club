"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type G = typeof window & { __ncInstallPrompt?: Event | null };

/**
 * Lot 6 — enregistre le service worker (/sw.js), garde l'invitation d'installation du navigateur
 * pour le bouton « Installer l'appli », et vide le cache des pages à la déconnexion.
 * En développement, le service worker n'est pas enregistré (sauf NEXT_PUBLIC_SW_DEV=1) pour ne pas gêner le rechargement à chaud.
 */
export function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault();
      (window as G).__ncInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", keep);
    if ("serviceWorker" in navigator && (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1")) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if ((q.has("au-revoir") || q.has("deconnexion")) && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "logout" });
    }
  }, [pathname]);

  return null;
}
