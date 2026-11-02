"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updatePassword, type LoginState } from "@/app/actions/auth";
import { Icon } from "../ui/Icon";

/** Choisir ou changer son mot de passe. */
export function PasswordForm({ back }: { back: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(updatePassword, null);
  const [show, setShow] = useState(false);
  if (state?.ok) {
    return (
      <>
        <div className="flash" role="status">
          <Icon name="check" />
          {state.message}
        </div>
        <Link className="btn btn-gold btn-block" href={back}>
          Continuer <Icon name="arrow-r" />
        </Link>
      </>
    );
  }
  return (
    <form action={action} className="login-form">
      {state && (
        <div className="flash" role="alert">
          <Icon name="bell" />
          {state.message}
        </div>
      )}
      <div className="field">
        <label htmlFor="pw-new">Nouveau mot de passe</label>
        <div className="pw-wrap">
          <input id="pw-new" name="password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required placeholder="8 caractères au moins" />
          <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
            <Icon name={show ? "eye-off" : "eye"} />
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="pw-confirm">Le même, encore une fois</label>
        <input id="pw-confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="lock" />}
        Enregistrer mon mot de passe
      </button>
      <p className="fine">
        <Icon name="lock" />
        Tu pourras toujours te connecter aussi avec un lien reçu par e-mail.
      </p>
    </form>
  );
}
