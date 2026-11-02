"use client";

import { useEffect, useState } from "react";
import { acceptContractAction, loadContractAction, prepareContractAction, type ContractClientView, type PrepareResult } from "@/app/actions/contrats";
import type { PrepareRequest } from "@/lib/modules/contrats/service";
import { Icon } from "../ui/Icon";
import { ContractDocument } from "./ContractDocument";

/**
 * Étape « Contrat » d'un parcours de souscription (isolée : un parcours l'affiche avant son paiement et
 * continue quand `onAccepted` est appelé). Lit le contrat (aperçu + PDF), case « J'ai lu et j'accepte »,
 * enregistre la preuve côté serveur. Un contrat déjà accepté pour cette souscription passe directement.
 */
export function ContractStep({
  request,
  contractId,
  onAccepted,
  onCancel,
  continueLabel = "Accepter et continuer",
}: {
  /** Souscription à couvrir (adhésion, renouvellement, abonnement pro…). */
  request?: PrepareRequest;
  /** Ou un contrat existant (Mes contrats). */
  contractId?: string;
  onAccepted: (contractId: string) => void;
  onCancel?: () => void;
  continueLabel?: string;
}) {
  const [state, setState] = useState<{ loading: true } | { loading: false; r: PrepareResult }>({ loading: true });
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = contractId ?? JSON.stringify(request ?? {});

  useEffect(() => {
    let live = true;
    setState({ loading: true });
    setChecked(false);
    setError(null);
    (contractId ? loadContractAction(contractId) : prepareContractAction(request!)).then((r) => {
      if (!live) return;
      if (r.ok && r.alreadyAccepted && request) onAccepted(r.contract.id);
      else setState({ loading: false, r });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.loading)
    return (
      <div className="ct-step" style={{ padding: "36px 0", textAlign: "center" }} aria-busy="true">
        <span className="spin" style={{ display: "inline-block", width: 26, height: 26 }} />
        <p className="muted" style={{ marginTop: 12 }}>
          Préparation de ton contrat…
        </p>
      </div>
    );

  if (!state.r.ok)
    return (
      <div className="ct-step">
        <div className="flash">
          <Icon name="bell" />
          {state.r.error}
        </div>
        {onCancel && (
          <button className="btn btn-ghost btn-block" type="button" onClick={onCancel}>
            Retour
          </button>
        )}
      </div>
    );

  const c: ContractClientView = state.r.contract;
  const accepted = c.status === "accepted";
  const cancelled = c.status === "cancelled";

  const accept = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError(null);
    const r = await acceptContractAction(c.id, c.sha256, checked);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    onAccepted(c.id);
  };

  return (
    <div className="ct-step">
      <h2 className="sh-title" style={{ marginBottom: 4 }}>
        {accepted ? "Ton contrat" : "Ton contrat, avant de payer"}
      </h2>
      <p className="sh-sub" style={{ marginBottom: 8 }}>
        {accepted ? `Accepté le ${new Date(c.acceptedAt ?? "").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.` : "Prends le temps de le lire : tu le retrouveras à tout moment dans « Mes contrats »."}
      </p>
      <div className="ct-sum">
        <span>Contrat</span>
        <b>{c.number}</b>
        <span>Formule</span>
        <b>{c.planLabel}</b>
        <span>Montant</span>
        <b>{c.amountLabel}</b>
        {c.scheduleLines.length > 1 && (
          <>
            <span>Échéancier</span>
            <b>{c.scheduleLines.length} échéances</b>
          </>
        )}
      </div>
      <div className="ct-scroll" tabIndex={0} aria-label={`Texte du contrat ${c.number}`}>
        <ContractDocument blocks={c.blocks} />
      </div>
      <div className="ct-links">
        <a href={c.pdfUrl} target="_blank" rel="noopener">
          Ouvrir le PDF
        </a>
        {accepted && (
          <a href={`${c.pdfUrl}?certificat=1`} target="_blank" rel="noopener">
            Certificat d’acceptation
          </a>
        )}
      </div>
      {error && (
        <div className="flash">
          <Icon name="bell" />
          {error}
        </div>
      )}
      {cancelled ? (
        <p className="muted">Ce contrat a été annulé.</p>
      ) : accepted ? (
        <button className="btn btn-gold btn-block" type="button" onClick={() => (request ? onAccepted(c.id) : onCancel?.())}>
          <Icon name="check" />
          {request ? "Continuer" : "Fermer"}
        </button>
      ) : (
        <>
          <label className="ct-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>
              <b>J’ai lu et j’accepte</b> le contrat n° {c.number} (modèle version {c.version}).
            </span>
          </label>
          <button className="btn btn-gold btn-block" type="button" onClick={accept} disabled={!checked || busy}>
            {busy ? (
              <>
                <span className="spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Icon name="lock" />
                {continueLabel}
              </>
            )}
          </button>
          <p className="fine">
            <Icon name="lock" />
            Nous gardons la date, l’heure, ton adresse IP et l’empreinte du document comme preuve de ton accord.
          </p>
        </>
      )}
      {onCancel && !accepted && (
        <button className="btn btn-ghost btn-block" type="button" style={{ marginTop: 8 }} onClick={onCancel}>
          Plus tard
        </button>
      )}
    </div>
  );
}
