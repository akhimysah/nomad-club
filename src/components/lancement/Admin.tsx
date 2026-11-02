"use client";

import { useActionState, useState, useTransition } from "react";
import { createInvitationAction, decideApplicationAction, revokeInvitationAction, setMembershipModeAction, type InvitationState } from "@/app/actions/lancement";
import { HEARD_FROM_LABEL, type ApplicationView, type MembershipMode, type RoleInvitation } from "@/lib/modules/lancement/types";
import { useToast } from "../ui/Toasts";
import { Icon } from "../ui/Icon";
import "@/styles/lancement.css";

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Casablanca" });

/** Réglage : adhésion sur validation (candidature) ou directe. */
export function MembershipModeSwitch({ mode }: { mode: MembershipMode }) {
  const [current, setCurrent] = useState(mode);
  const [pending, start] = useTransition();
  const toast = useToast();
  const choose = (m: MembershipMode) =>
    start(async () => {
      const r = await setMembershipModeAction(m);
      if (r.ok) setCurrent(m);
      toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    });
  return (
    <div className="lc-mode" role="radiogroup" aria-label="Mode d’adhésion">
      {(["validation", "direct"] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={current === m} className={`btn btn-sm ${current === m ? "btn-gold" : "btn-ghost"}`} disabled={pending} onClick={() => choose(m)}>
          {m === "validation" ? "Sur validation des candidatures" : "Directe, sans validation"}
        </button>
      ))}
    </div>
  );
}

function Decision({ app }: { app: ApplicationView }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const toast = useToast();
  const decide = (accept: boolean) =>
    start(async () => {
      const r = await decideApplicationAction(app.id, accept, msg);
      toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
      if (r.ok) setDone(accept ? "Acceptée" : "Refusée");
    });
  if (done) return <p className="muted">{done} · la personne est prévenue.</p>;
  return (
    <>
      <label className="lc-legend" htmlFor={`msg-${app.id}`}>
        Message à {app.name.split(" ")[0]} (obligatoire pour un refus)
      </label>
      <textarea id={`msg-${app.id}`} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} placeholder="Ravies de t’accueillir… / Merci pour ta demande, mais…" />
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-gold btn-sm" disabled={pending} onClick={() => decide(true)}>
          <Icon name="check" />
          Accepter
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => decide(false)}>
          <Icon name="x" />
          Refuser
        </button>
      </div>
    </>
  );
}

/** File « Candidatures » : en attente d'abord, puis l'historique. */
export function ApplicationsBoard({ apps }: { apps: ApplicationView[] }) {
  const pending = apps.filter((a) => a.status === "pending");
  const others = apps.filter((a) => a.status !== "pending");
  return (
    <>
      {pending.length === 0 && <p className="muted">Aucune candidature en attente.</p>}
      <div className="lc-apps">
        {pending.map((a) => (
          <article key={a.id} className="lc-app" aria-labelledby={`app-${a.id}`}>
            <h3 id={`app-${a.id}`}>{a.name}</h3>
            <p className="lc-meta">
              <span>{a.job}{a.company ? ` · ${a.company}` : ""}</span>
              <span>À Marrakech depuis {a.marrakechSince}</span>
              {a.country && <span>{a.country}</span>}
              {a.heardFrom && <span>Connue par : {HEARD_FROM_LABEL[a.heardFrom]}</span>}
              <span>Reçue le {dateFr(a.createdAt)}</span>
            </p>
            <p className="lc-meta">
              {a.email && <a href={`mailto:${a.email}`}>{a.email}</a>}
              {a.whatsapp && <a href={`https://wa.me/${a.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp {a.whatsapp}</a>}
            </p>
            <blockquote>{a.motivation}</blockquote>
            <Decision app={a} />
          </article>
        ))}
      </div>
      {others.length > 0 && (
        <details style={{ marginTop: 22 }}>
          <summary>Historique ({others.length})</summary>
          <table className="lc-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th scope="col">Personne</th>
                <th scope="col">Statut</th>
                <th scope="col">Réponse</th>
              </tr>
            </thead>
            <tbody>
              {others.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.name}</b>
                    <br />
                    <span className="muted">{a.job}</span>
                  </td>
                  <td>
                    <span className="lc-badge">{a.status === "accepted" ? "Acceptée" : a.status === "refused" ? "Refusée" : "Retirée"}</span>
                  </td>
                  <td>
                    {a.decidedAt ? `${dateFr(a.decidedAt)}${a.decidedByName ? ` par ${a.decidedByName}` : ""}` : "—"}
                    {a.decisionMessage && <div className="muted">« {a.decisionMessage} »</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}

const ROLE_FR: Record<RoleInvitation["role"], string> = { moderator: "Modératrice", partner: "Partenaire", pro: "Pro (carnet)" };
const STATE_FR: Record<RoleInvitation["state"], string> = { open: "En attente", used: "Acceptée", revoked: "Annulée", expired: "Expirée" };

function CopyLink({ link }: { link: string }) {
  const toast = useToast();
  return (
    <div className="lc-copy">
      <input readOnly value={link} aria-label="Lien d’invitation" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast("Lien copié.", "check");
          } catch {
            toast("Copie impossible : sélectionne le lien.", "bell");
          }
        }}
      >
        Copier
      </button>
    </div>
  );
}

/** Rôles et accès : inviter une personne par e-mail (lien à usage unique), suivre et annuler les invitations. */
export function InvitationsPanel({ invitations, organizations }: { invitations: RoleInvitation[]; organizations: Array<{ id: string; name: string; kinds: string[] }> }) {
  const [state, action, pending] = useActionState<InvitationState, FormData>(createInvitationAction, null);
  const [role, setRole] = useState<RoleInvitation["role"]>("moderator");
  const [busy, start] = useTransition();
  const toast = useToast();
  const orgs = organizations.filter((o) => role !== "moderator" && o.kinds.includes(role));
  return (
    <section className="card" aria-labelledby="inv-h" style={{ marginTop: 22 }}>
      <div className="card-h">
        <h2 id="inv-h">Inviter par e-mail</h2>
        <span className="muted">Lien à usage unique, valable 14 jours</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        La personne crée son compte (ou se connecte) avec cette adresse : le rôle lui est attribué automatiquement.
      </p>
      <form action={action}>
        {state && (
          <div className="flash" role={state.ok ? "status" : "alert"}>
            <Icon name={state.ok ? "check" : "bell"} />
            <span>
              {state.message}
              {state.link && !state.emailed && <CopyLink link={state.link} />}
            </span>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor="inv-email">Adresse e-mail</label>
            <input id="inv-email" name="email" type="email" required autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="inv-role">Rôle</label>
            <select id="inv-role" name="role" value={role} onChange={(e) => setRole(e.target.value as RoleInvitation["role"])}>
              <option value="moderator">Modératrice</option>
              <option value="partner">Partenaire (offres)</option>
              <option value="pro">Pro du carnet</option>
            </select>
          </div>
        </div>
        {orgs.length > 0 && (
          <div className="field">
            <label htmlFor="inv-org">Établissement (facultatif)</label>
            <select id="inv-org" name="organizationId" defaultValue="">
              <option value="">Aucun pour l’instant</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="inv-note">Note pour l’e-mail (facultatif)</label>
          <input id="inv-note" name="note" maxLength={300} />
        </div>
        <button className="btn btn-gold" type="submit" disabled={pending}>
          {pending ? <span className="spin" /> : <Icon name="send" />}
          Envoyer l’invitation
        </button>
      </form>
      {invitations.length > 0 && (
        <table className="lc-table" style={{ marginTop: 22 }}>
          <caption className="muted" style={{ textAlign: "left", marginBottom: 8 }}>
            Invitations envoyées
          </caption>
          <thead>
            <tr>
              <th scope="col">Adresse</th>
              <th scope="col">Rôle</th>
              <th scope="col">État</th>
              <th scope="col">
                <span className="lc-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((i) => (
              <tr key={i.id}>
                <td>{i.email}</td>
                <td>{ROLE_FR[i.role]}</td>
                <td>
                  <span className={`lc-badge${i.state === "open" ? " pending" : ""}`}>{STATE_FR[i.state]}</span>
                  <div className="muted">{i.state === "open" ? `jusqu’au ${dateFr(i.expiresAt)}` : i.acceptedAt ? dateFr(i.acceptedAt) : ""}</div>
                </td>
                <td>
                  {i.state === "open" && (
                    <button
                      type="button"
                      className="lc-link-btn"
                      disabled={busy}
                      onClick={() =>
                        start(async () => {
                          const r = await revokeInvitationAction(i.id);
                          toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
                        })
                      }
                    >
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
