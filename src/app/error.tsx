"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/lancement/ErrorScreen";

/** Vague 2 — erreur inattendue (500) : message de la marque, nouvel essai, signalement si la surveillance est active. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/erreurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, name: error.name, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);
  return (
    <ErrorScreen code="Erreur 500" title="Quelque chose s’est mal passé.">
      <p className="sh-sub">
        Ce n’est pas toi : la page n’a pas pu s’afficher. Réessaie dans un instant ; si cela continue, écris à Julia et Nora sur WhatsApp.
        {error.digest ? (
          <>
            <br />
            <small className="muted">Référence : {error.digest}</small>
          </>
        ) : null}
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-gold" onClick={() => reset()}>
          Réessayer
        </button>
        <Link className="btn btn-ghost" href="/">
          Retour à l’accueil
        </Link>
      </div>
    </ErrorScreen>
  );
}
