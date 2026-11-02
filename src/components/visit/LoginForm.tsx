"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, sendPasswordReset, signInWithPassword, type LoginState } from "@/app/actions/auth";
import { Icon } from "../ui/Icon";

type Kind = "password" | "link" | "reset";

/** Connexion (mode réel) : mot de passe, ou lien reçu par e-mail. Le lien sert aussi à créer son compte. */
export function LoginForm({ next, parrain = null }: { next: string; parrain?: string | null }) {
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(signInWithPassword, null);
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendMagicLink, null);
  const [resetState, resetAction, resetPending] = useActionState<LoginState, FormData>(sendPasswordReset, null);
  const [last, setLast] = useState<Kind>("password");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState(""); // gardé après l’envoi (le formulaire se vide sinon)
  const state = { password: pwState, link: linkState, reset: resetState }[last];
  const pending = pwPending || linkPending || resetPending;

  return (
    <form action={pwAction} className="login-form">
      <input type="hidden" name="suite" value={next} />
      {state && (
        <div className="flash" role="status">
          <Icon name={state.ok ? "check" : "bell"} />
          {state.message}
        </div>
      )}
      <div className="field">
        <label htmlFor="login-email">Ton adresse e-mail</label>
        <input id="login-email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="prenom@exemple.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <div className="field-top">
          <label htmlFor="login-password">Mot de passe</label>
          <button type="submit" className="link-btn" formAction={resetAction} onClick={() => setLast("reset")} disabled={pending}>
            Mot de passe oublié ?
          </button>
        </div>
        <div className="pw-wrap">
          <input id="login-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" />
          <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
            <Icon name={show ? "eye-off" : "eye"} />
          </button>
        </div>
      </div>
      <button className="btn btn-gold btn-block" type="submit" onClick={() => setLast("password")} disabled={pending}>
        {pwPending ? <span className="spin" /> : <Icon name="lock" />}
        Se connecter
      </button>

      <div className="login-or" aria-hidden="true">
        <span>ou</span>
      </div>

      <button className="btn btn-ghost btn-block" type="submit" formAction={linkAction} onClick={() => setLast("link")} disabled={pending}>
        {linkPending ? <span className="spin" /> : <Icon name="send" />}
        Recevoir un lien de connexion
      </button>
      <p className="fine">
        <Icon name="spark" />
        Pas encore de compte ou pas de mot de passe ? Le lien suffit, tu pourras en choisir un ensuite.
      </p>

      {/* --- Lot 4 --- : parrainage à l'inscription (envoyé avec le lien) */}
      <details className="login-more" open={Boolean(parrain)}>
        <summary>J’ai un code de parrainage</summary>
        <div className="field">
          <label htmlFor="login-parrain">Code de parrainage</label>
          <input id="login-parrain" name="parrain" type="text" autoComplete="off" autoCapitalize="characters" placeholder="INES-7K2Q" defaultValue={parrain ?? ""} maxLength={20} />
        </div>
      </details>
    </form>
  );
}
