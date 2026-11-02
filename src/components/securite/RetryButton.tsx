"use client";

import { Icon } from "../ui/Icon";

/** Lot 6 — « Réessayer » de la page hors ligne. */
export function RetryButton() {
  return (
    <button type="button" className="btn btn-gold" onClick={() => window.location.reload()}>
      <Icon name="refresh" />
      Réessayer
    </button>
  );
}
