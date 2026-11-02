"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type FormState } from "@/app/actions/lancement";
import { HEARD_FROM, HEARD_FROM_LABEL } from "@/lib/modules/lancement/types";
import { Icon } from "../ui/Icon";

/** Inscription : fiche, CGU et choix « compte gratuit » ou « demander l'adhésion ». Lien magique à la fin. */
export function SignupForm({
  parrain,
  path,
  invitation,
  emailHint,
  applyLabel,
}: {
  parrain: string | null;
  path: "free" | "apply";
  invitation: string | null;
  emailHint: string | null;
  applyLabel: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, null);
  const err = (f: string) => (state && !state.ok && state.field === f ? " err" : "");
  const described = (f: string) => (state && !state.ok && state.field === f ? "signup-msg" : undefined);
  if (state?.ok)
    return (
      <div className="flash" role="status" id="signup-msg">
        <Icon name="send" />
        <span>{state.message}</span>
      </div>
    );
  return (
    <form action={action} noValidate>
      {invitation && <input type="hidden" name="invitation" value={invitation} />}
      {state && !state.ok && (
        <div className="flash" role="alert" id="signup-msg">
          <Icon name="bell" />
          <span>{state.message}</span>
        </div>
      )}
      <div className={`field${err("email")}`}>
        <label htmlFor="su-email">Adresse e-mail</label>
        <input id="su-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder={emailHint ?? "prenom@exemple.com"} required aria-describedby={described("email")} />
        {emailHint && <span className="lc-hint">Utilise l’adresse qui a reçu l’invitation ({emailHint}).</span>}
      </div>
      <div className="field-row">
        <div className={`field${err("firstName")}`}>
          <label htmlFor="su-first">Prénom</label>
          <input id="su-first" name="firstName" autoComplete="given-name" required aria-describedby={described("firstName")} />
        </div>
        <div className={`field${err("lastName")}`}>
          <label htmlFor="su-last">Nom</label>
          <input id="su-last" name="lastName" autoComplete="family-name" required aria-describedby={described("lastName")} />
        </div>
      </div>
      <div className="field-row">
        <div className={`field${err("whatsapp")}`}>
          <label htmlFor="su-wa">WhatsApp</label>
          <input id="su-wa" name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" placeholder="+212 6 …" required aria-describedby={described("whatsapp")} />
        </div>
        <div className={`field${err("country")}`}>
          <label htmlFor="su-country">Pays ou nationalité</label>
          <input id="su-country" name="country" autoComplete="country-name" required aria-describedby={described("country")} />
        </div>
      </div>
      <div className={`field${err("heardFrom")}`}>
        <label htmlFor="su-heard">Comment as-tu connu le club ?</label>
        <select id="su-heard" name="heardFrom" defaultValue="" required aria-describedby={described("heardFrom")}>
          <option value="" disabled>
            Choisis une réponse
          </option>
          {HEARD_FROM.map((h) => (
            <option key={h} value={h}>
              {HEARD_FROM_LABEL[h]}
            </option>
          ))}
        </select>
      </div>
      <div className={`field${err("heardFromDetail")}`}>
        <label htmlFor="su-detail">Une précision ? (facultatif)</label>
        <input id="su-detail" name="heardFromDetail" maxLength={200} placeholder="Le prénom de la membre, le nom de l’événement…" />
      </div>
      <div className={`field${err("referralCode")}`}>
        <label htmlFor="su-parrain">Code de parrainage (facultatif)</label>
        <input id="su-parrain" name="referralCode" autoComplete="off" autoCapitalize="characters" placeholder="INES-7K2Q" defaultValue={parrain ?? ""} maxLength={24} />
      </div>
      {!invitation && (
        <fieldset className="lc-fieldset">
          <legend className="lc-legend">Ensuite, tu préfères…</legend>
          <div className="lc-choices">
            <label className="lc-choice">
              <input type="radio" name="path" value="free" defaultChecked={path === "free"} />
              <span>
                <b>Rester en compte gratuit</b>
                <small>Agenda, réservations au tarif public, actualités. Tu pourras adhérer plus tard.</small>
              </span>
            </label>
            <label className="lc-choice">
              <input type="radio" name="path" value="apply" defaultChecked={path === "apply"} />
              <span>
                <b>{applyLabel}</b>
                <small>Annuaire, messages privés, offres partenaires et tarif membre.</small>
              </span>
            </label>
          </div>
        </fieldset>
      )}
      <label className={`lc-check${err("terms")}`}>
        <input type="checkbox" name="terms" required aria-describedby={described("terms")} />
        <span>
          J’accepte les <Link href="/cgu" target="_blank">conditions d’utilisation</Link> et la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link> du Nomad Club.
        </span>
      </label>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="send" />}
        Créer mon compte
      </button>
      <p className="fine">
        <Icon name="lock" />
        Pas de mot de passe : un lien de connexion arrive par e-mail.
      </p>
    </form>
  );
}
