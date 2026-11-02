import Link from "next/link";
import { getRepo } from "@/lib/data";
import { dayMonthShort, hour } from "@/lib/format";
import { CONSENT_LABEL, consentStates, GRACE_DAYS } from "@/lib/modules/securite/consents";
import { vapidPublicKey } from "@/lib/modules/securite/push";
import type { Profile, Viewer } from "@/lib/types";
import { Icon } from "../ui/Icon";
import { ConsentList } from "./ConsentList";
import { DeletionCard } from "./DeletionCard";
import { InstallHelp } from "./InstallHelp";
import { PushToggle } from "./PushToggle";
import { SessionsCard } from "./SessionsCard";
import "@/styles/securite.css";

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Casablanca" });

function device(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  const os = /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /mac/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : null;
  const nav = /edg/i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : null;
  return [nav, os].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

/**
 * Lot 6 — « Mes données » : consentements (avec historique), export, notifications sur l'appareil,
 * appareils connectés, installation, suppression du compte. Commun à l'espace membre et à /mes-donnees.
 */
export async function MyDataBody({ viewer, profile, exportHref }: { viewer: Viewer; profile: Profile; exportHref: string }) {
  const repo = getRepo();
  const [history, open, sessions] = await Promise.all([repo.listConsents(profile.id), repo.getOpenDeletionRequest(profile.id), repo.listMySessions(profile.id)]);
  const states = consentStates(history).map((s) => ({ ...s, when: s.at ? `${dateFr(s.at)} à ${hour(s.at)}` : null }));
  const demo = viewer.mode === "demo";
  const admin = profile.roles.includes("admin");
  return (
    <div className="sec-grid">
      <div className="sec-col">
        <section className="card" aria-labelledby="consents-h">
          <div className="card-h">
            <h2 id="consents-h">Mes consentements</h2>
            <span className="muted">Modifiables à tout moment</span>
          </div>
          <ConsentList states={states} />
          {history.length > 0 && (
            <details className="sec-history">
              <summary>Historique de mes choix ({history.length})</summary>
              <ul>
                {history.map((c) => (
                  <li key={c.id}>
                    <time dateTime={c.createdAt}>
                      {dayMonthShort(c.createdAt)} {new Date(c.createdAt).getFullYear()} · {hour(c.createdAt)}
                    </time>
                    <span>
                      {CONSENT_LABEL[c.kind].label} : <b>{c.granted ? "accepté" : "refusé"}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="card" aria-labelledby="export-h">
          <div className="card-h">
            <h2 id="export-h">Mes données</h2>
          </div>
          <p className="muted">
            Profil, rôles, consentements, réservations, paiements, adhésions, messages écrits, notifications et préférences : tout ce que le club garde sur toi, dans un
            fichier JSON lisible et réutilisable.
          </p>
          <a className="btn btn-ink btn-sm" href={exportHref} download>
            <Icon name="arrow-r" />
            Télécharger mes données
          </a>
          <p className="muted sec-note">
            Une erreur dans tes informations ? Écris aux fondatrices pour la corriger. Les règles : <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>

        <section className="card" aria-labelledby="push-h">
          <div className="card-h">
            <h2 id="push-h">Sur ce téléphone</h2>
          </div>
          <p className="muted">Reçois les notifications du club (places libérées, nouveaux rendez-vous) même appli fermée. Les types se règlent dans Notifications.</p>
          <PushToggle vapidKey={demo ? null : vapidPublicKey()} demo={demo} />
          <div className="sec-install-row">
            <InstallHelp />
          </div>
        </section>
      </div>

      <div className="sec-col">
        <section className="card" aria-labelledby="sessions-h">
          <div className="card-h">
            <h2 id="sessions-h">Mes appareils connectés</h2>
          </div>
          <SessionsCard
            demo={demo}
            listed={demo || sessions.length > 0}
            sessions={sessions.map((s) => ({ id: s.id, device: device(s.userAgent), last: `${dayMonthShort(s.updatedAt ?? s.createdAt)} · ${hour(s.updatedAt ?? s.createdAt)}`, aal: s.aal }))}
          />
        </section>

        <section className="card" aria-labelledby="delete-h">
          <div className="card-h">
            <h2 id="delete-h">Supprimer mon compte</h2>
          </div>
          <DeletionCard
            graceDays={GRACE_DAYS}
            blocked={admin ? "Compte administratrice : demande d’abord à l’autre fondatrice de te retirer ce rôle." : null}
            pending={open ? { requestedAt: dateFr(open.requestedAt), scheduledFor: dateFr(open.scheduledFor) } : null}
          />
        </section>
      </div>
    </div>
  );
}
