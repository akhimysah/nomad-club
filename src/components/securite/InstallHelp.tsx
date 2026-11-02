"use client";

import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";

type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type G = typeof window & { __ncInstallPrompt?: BeforeInstallPrompt | null };

/**
 * Lot 6 — « Ajouter à l'écran d'accueil ».
 * Android / Chrome / Edge : le vrai bouton d'installation du navigateur (événement beforeinstallprompt).
 * iPhone / iPad (Safari) : pas d'API, on montre la marche à suivre (Partager › Sur l'écran d'accueil).
 */
export function InstallHelp({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPrompt | null>(null);
  const [os, setOs] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    setOs(/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? "ios" : /android/i.test(ua) ? "android" : "other");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const g = window as G;
    if (g.__ncInstallPrompt) setPrompt(g.__ncInstallPrompt);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      g.__ncInstallPrompt = e as BeforeInstallPrompt;
      setPrompt(e as BeforeInstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed)
    return (
      <span className="chip">
        <Icon name="check" />
        Appli installée sur cet appareil
      </span>
    );

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            const choice = await prompt.userChoice.catch(() => null);
            (window as G).__ncInstallPrompt = null;
            setPrompt(null);
            if (choice?.outcome === "accepted") setInstalled(true);
            return;
          }
          setOpen(true);
        }}
      >
        <Icon name="phone" />
        Installer l’appli
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Installer l’appli">
        <div className="sec-install">
          <div className="eyebrow">Sur ton téléphone</div>
          <h2 className="sh-title">Nomad Club sur ton écran d’accueil</h2>
          <p className="sh-sub">Une icône comme une vraie appli, en plein écran, qui s’ouvre même sans réseau sur les pages déjà vues.</p>
          <div className={"sec-os" + (os === "ios" ? " on" : "")}>
            <h3>iPhone ou iPad (Safari)</h3>
            <ol>
              <li>Ouvre ce site dans Safari.</li>
              <li>
                Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).
              </li>
              <li>
                Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.
              </li>
            </ol>
          </div>
          <div className={"sec-os" + (os === "android" ? " on" : "")}>
            <h3>Android (Chrome)</h3>
            <ol>
              <li>
                Touche le menu <b>⋮</b> en haut à droite.
              </li>
              <li>
                Choisis <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).
              </li>
              <li>Confirme : l’icône Nomad Club apparaît avec tes applis.</li>
            </ol>
          </div>
          <button type="button" className="btn btn-gold btn-block" onClick={() => setOpen(false)}>
            C’est noté
          </button>
        </div>
      </Sheet>
    </>
  );
}
