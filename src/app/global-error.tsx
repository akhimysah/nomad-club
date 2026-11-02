"use client";

import Link from "next/link";
import { useEffect } from "react";
import "./globals.css";
import "../styles/lancement.css";

/** Vague 2 — erreur dans la mise en page racine elle-même : page autonome (html + body), sans dépendance. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/erreurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, name: error.name, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);
  return (
    <html lang="fr" translate="no">
      <body>
        <section className="lc-error" aria-label="Erreur">
          <div className="lc-error-in">
            {/* image statique : next/image n'est pas disponible si la mise en page racine a échoué */}
            <img src="/img/monogramme-clair.png" alt="Nomad Club" width={54} height={84} />
            <div className="lc-error-code">Erreur 500</div>
            <h1 className="sh-title">L’appli a rencontré un problème.</h1>
            <p className="sh-sub">Réessaie dans un instant. Si cela continue, écris à Julia et Nora sur WhatsApp.</p>
            <div className="btn-row">
              <button type="button" className="btn btn-gold" onClick={() => reset()}>
                Réessayer
              </button>
              <Link className="btn btn-ghost" href="/">
                Retour à l’accueil
              </Link>
            </div>
          </div>
        </section>
      </body>
    </html>
  );
}
