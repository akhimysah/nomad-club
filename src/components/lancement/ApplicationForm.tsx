"use client";

import { useActionState } from "react";
import { submitApplicationAction, type FormState } from "@/app/actions/lancement";
import { Icon } from "../ui/Icon";

/** Candidature d'adhésion : métier, entreprise, arrivée à Marrakech, motivations. */
export function ApplicationForm({ job, marrakechSince }: { job: string | null; marrakechSince: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitApplicationAction, null);
  const err = (f: string) => (state && !state.ok && state.field === f ? " err" : "");
  const described = (f: string) => (state && !state.ok && state.field === f ? "ap-msg" : undefined);
  if (state?.ok)
    return (
      <div className="flash" role="status">
        <Icon name="check" />
        <span>{state.message}</span>
      </div>
    );
  return (
    <form action={action}>
      {state && !state.ok && (
        <div className="flash" role="alert" id="ap-msg">
          <Icon name="bell" />
          <span>{state.message}</span>
        </div>
      )}
      <div className={`field${err("job")}`}>
        <label htmlFor="ap-job">Ton métier</label>
        <input id="ap-job" name="job" aria-describedby={described("job")} required maxLength={120} defaultValue={job ?? ""} autoComplete="organization-title" />
      </div>
      <div className="field-row">
        <div className={`field${err("company")}`}>
          <label htmlFor="ap-company">Entreprise (facultatif)</label>
          <input id="ap-company" name="company" aria-describedby={described("company")} maxLength={120} autoComplete="organization" />
        </div>
        <div className={`field${err("marrakechSince")}`}>
          <label htmlFor="ap-since">À Marrakech depuis</label>
          <input id="ap-since" name="marrakechSince" aria-describedby={described("marrakechSince")} required maxLength={40} placeholder="2024, toujours…" defaultValue={marrakechSince ?? ""} />
        </div>
      </div>
      <div className={`field${err("motivation")}`}>
        <label htmlFor="ap-motivation">Pourquoi veux-tu rejoindre le club ?</label>
        <textarea id="ap-motivation" name="motivation" aria-describedby={described("motivation")} required minLength={20} maxLength={2000} style={{ height: 160 }} placeholder="Ce que tu cherches, ce que tu aimerais apporter au cercle…" />
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="send" />}
        Envoyer ma candidature
      </button>
      <p className="fine">
        <Icon name="lock" />
        Lue uniquement par Julia et Nora, les fondatrices.
      </p>
    </form>
  );
}
