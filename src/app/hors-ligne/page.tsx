import type { Metadata } from "next";
import { RetryButton } from "@/components/securite/RetryButton";
import "@/styles/securite.css";

export const metadata: Metadata = { title: "Hors ligne", robots: { index: false } };
export const dynamic = "force-static";

/** Lot 6 — page affichée par le service worker quand il n'y a ni réseau ni copie de la page demandée. */
export default function OfflinePage() {
  return (
    <section className="space on sec-offline" aria-label="Hors ligne">
      <div className="sec-offline-in">
        <img src="/img/monogramme-clair.png" alt="" width={96} height={96} className="sec-offline-mono" />
        <div className="eyebrow">Hors ligne</div>
        <h1 className="h-display sec-offline-title">
          Pas de réseau <em>pour l’instant</em>
        </h1>
        <p className="lead">Les pages déjà ouvertes restent consultables. Le reste revient dès que la connexion est de retour : réservations, messages et paiements ont besoin du réseau.</p>
        {/* vrais liens (pas <Link>) : une navigation complète passe par le service worker, qui sert les copies en cache */}
        {/* eslint-disable @next/next/no-html-link-for-pages */}
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <RetryButton />
          <a className="btn btn-ghost" href="/">
            Accueil
          </a>
          <a className="btn btn-ghost" href="/espace/agenda">
            Mon agenda
          </a>
        </div>
        {/* eslint-enable @next/next/no-html-link-for-pages */}
      </div>
    </section>
  );
}
