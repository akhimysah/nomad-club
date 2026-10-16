"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "@/app/actions/auth";
import { Icon } from "../ui/Icon";

/** Connexion par lien magique (mode réel). */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, null);
  return (
    <form action={action}>
      <input type="hidden" name="suite" value={next} />
      {state && (
        <div className="flash" role="status">
          <Icon name={state.ok ? "check" : "bell"} />
          {state.message}
        </div>
      )}
      <div className="field">
        <label htmlFor="login-email">Ton adresse e-mail</label>
        <input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="prenom@exemple.com" required />
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="send" />}
        Recevoir mon lien de connexion
      </button>
      <p className="fine">
        <Icon name="lock" />
        Pas de mot de passe : un lien suffit.
      </p>
    </form>
  );
}
