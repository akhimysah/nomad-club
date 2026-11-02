"use client";

import { useState, useTransition } from "react";
import { startMfaEnrollAction, verifyMfaAction } from "@/app/actions/securite";
import { Icon } from "../ui/Icon";

type Props = {
  /** enroll : première fois (QR code) ; verify : facteur déjà enrôlé, saisir le code. */
  mode: "enroll" | "verify";
  suite: string;
  /** Démo : écran simulé, aucun facteur réel. */
  demo?: { qrPath: string; qrSize: number; secret: string };
};

/** Lot 6 — double authentification (TOTP) : enrôlement par QR code puis vérification d'un code à 6 chiffres. */
export function MfaPanel({ mode, suite, demo }: Props) {
  const [busy, start] = useTransition();
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [demoDone, setDemoDone] = useState(false);

  const needQr = mode === "enroll";
  const showCode = !needQr || enroll || demo;

  const submit = () =>
    start(async () => {
      setError(null);
      if (demo) {
        if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) setError("Le code à 6 chiffres de ton application.");
        else setDemoDone(true);
        return;
      }
      const r = await verifyMfaAction(enroll?.factorId ?? null, code, suite);
      if (r && !r.ok) setError(r.error);
    });

  if (demoDone)
    return (
      <div className="flash">
        <Icon name="check" />
        Simulé : en mode réel, la session passe au niveau AAL2 et l’espace fondatrices s’ouvre.
      </div>
    );

  return (
    <div className="sec-mfa">
      {needQr && !enroll && !demo && (
        <button
          type="button"
          className="btn btn-gold"
          aria-busy={busy}
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await startMfaEnrollAction();
              if (r.ok) setEnroll(r);
              else setError(r.error);
            })
          }
        >
          <Icon name="lock" />
          Activer la double authentification
        </button>
      )}

      {needQr && (enroll || demo) && (
        <div className="sec-qr">
          {demo ? (
            <svg viewBox={`-2 -2 ${demo.qrSize + 4} ${demo.qrSize + 4}`} width="180" height="180" role="img" aria-label="QR code de démonstration">
              <rect x="-2" y="-2" width={demo.qrSize + 4} height={demo.qrSize + 4} fill="#fff" />
              <path d={demo.qrPath} fill="#111" />
            </svg>
          ) : (
            <img src={enroll!.qr} width={180} height={180} alt="QR code à scanner avec ton application d’authentification" />
          )}
          <ol>
            <li>
              Ouvre une application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).
            </li>
            <li>Scanne ce QR code, ou saisis la clé à la main :</li>
          </ol>
          <code className="sec-secret">{demo ? demo.secret : enroll!.secret}</code>
        </div>
      )}

      {showCode && (
        <form
          className="sec-code"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>Code à 6 chiffres</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              autoFocus={!needQr}
            />
          </label>
          {error && (
            <span className="err-msg" role="alert">
              {error}
            </span>
          )}
          <button type="submit" className="btn btn-ink" aria-busy={busy} disabled={busy}>
            Vérifier
          </button>
        </form>
      )}
      {!showCode && error && (
        <span className="err-msg" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
