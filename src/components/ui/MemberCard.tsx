"use client";

import { useTilt } from "./useTilt";

/** Carte de membre numérique (noire en Membre, argentée en Premium). */
export function MemberCard({ name, premium, validUntil, cardNumber }: { name: string; premium: boolean; validUntil: string; cardNumber: string }) {
  const ref = useTilt<HTMLDivElement>();
  return (
    <div ref={ref} className={"mcard" + (premium ? " premium" : "")} tabIndex={0} aria-label={`Carte de membre de ${name}`}>
      <img className="mc-mono" src="/img/monogramme-clair.png" alt="" />
      <div className="mc-top">
        <img className="mc-logo" src="/img/logotype-clair.png" alt="Nomad Club" />
        <span className="mc-formule">{premium ? "Premium" : "Membre"}</span>
      </div>
      <div className="mc-chip" />
      <div>
        <div className="mc-name">{name}</div>
        <div className="mc-meta" style={{ marginTop: 10 }}>
          <span>
            Carte n°<b>{cardNumber}</b>
          </span>
          <span style={{ textAlign: "right" }}>
            Valable jusqu’au<b>{validUntil}</b>
          </span>
        </div>
      </div>
      <div className="sheen" />
    </div>
  );
}
