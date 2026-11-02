import type { Metadata } from "next";
import Link from "next/link";
import { ResendEmailButton } from "@/components/emails/EmailButtons";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { dayMonthShort, hour } from "@/lib/format";
import { DEFAULT_FROM, emailBaseUrl, emailFrom, emailProvider, emailReplyTo, unsubscribeSecret } from "@/lib/modules/emails/config";
import { emailLogStore } from "@/lib/modules/emails/log-store";
import { TEMPLATES } from "@/lib/modules/emails/templates";
import { TEMPLATE_IDS, type EmailLogEntry, type EmailLogFilters } from "@/lib/modules/emails/types";
import "@/styles/emails.css";

export const metadata: Metadata = { title: "E-mails" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const label = (id: string) => (id in TEMPLATES ? TEMPLATES[id as keyof typeof TEMPLATES].label : id);

/** E-mails — journal des derniers envois (filtres, renvoi), état de la configuration, modèles à relire. */
export default async function EmailsPage({ searchParams }: Props) {
  const v = await requireCapability("space.admin", { next: "/fondatrices/emails" });
  const sp = await searchParams;
  const filters: EmailLogFilters = { limit: 200 };
  const tpl = one(sp.modele);
  if (tpl && (TEMPLATE_IDS as readonly string[]).includes(tpl)) filters.template = tpl;
  const st = one(sp.statut);
  if (st === "sent" || st === "failed") filters.status = st;
  const q = one(sp.q)?.trim().slice(0, 80);
  if (q) filters.q = q;
  const filtered = Boolean(filters.template || filters.status || filters.q);

  let log: EmailLogEntry[] = [];
  let loadError: string | null = null;
  try {
    log = await emailLogStore().list(filters);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Lecture impossible.";
  }
  const failed = log.filter((e) => e.status === "failed").length;

  const demo = v.mode === "demo";
  const provider = emailProvider();
  const from = emailFrom();
  const base = emailBaseUrl();
  const checks: Array<[boolean, string, string]> = [
    [
      provider === "resend",
      "Fournisseur d’envoi",
      provider === "resend" ? "Resend (RESEND_API_KEY configurée)" : provider === "smtp" ? "SMTP (prévu, voir docs/emails.md)" : "Console : aucun e-mail ne part, les envois sont seulement journalisés",
    ],
    [from !== DEFAULT_FROM, "Expéditeur (EMAIL_FROM)", from],
    [Boolean(emailReplyTo()), "Adresse de réponse (EMAIL_REPLY_TO)", emailReplyTo() ?? "Non définie : les réponses vont à l’expéditeur"],
    [!base.includes("localhost"), "Adresse des liens (NEXT_PUBLIC_SITE_URL)", base],
    [Boolean(unsubscribeSecret()), "Liens de désinscription signés", unsubscribeSecret() ? "Actifs" : "Désactivés : définir EMAIL_UNSUBSCRIBE_SECRET ou CRON_SECRET"],
    [!demo && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), "Journal des envois en base", demo ? "Mode démo : en mémoire" : process.env.SUPABASE_SERVICE_ROLE_KEY ? "Table email_log" : "Clé service absente : envois non journalisés"],
    [false, "Lien magique de connexion", "Envoyé par Supabase Auth : brancher son SMTP sur Resend (docs/emails.md)"],
  ];

  return (
    <Screen group="founders" index={11} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="E-mails" sub="Envois, modèles, configuration" />
        <div className="em-grid">
          <div className="em-col">
            <form className="card em-filters" method="get" action="/fondatrices/emails" role="search" aria-label="Filtrer les envois">
              <label className="field">
                <span>Recherche</span>
                <input name="q" type="search" defaultValue={q ?? ""} placeholder="Adresse, objet…" maxLength={80} />
              </label>
              <label className="field">
                <span>Modèle</span>
                <select name="modele" defaultValue={filters.template ?? ""}>
                  <option value="">Tous</option>
                  {TEMPLATE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {TEMPLATES[id].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Statut</span>
                <select name="statut" defaultValue={filters.status ?? ""}>
                  <option value="">Tous</option>
                  <option value="sent">Envoyés</option>
                  <option value="failed">En échec</option>
                </select>
              </label>
              <div className="em-filter-actions">
                <button className="btn btn-ink btn-sm" type="submit">
                  <Icon name="search" />
                  Filtrer
                </button>
                {filtered && (
                  <Link className="btn btn-ghost btn-sm" href="/fondatrices/emails">
                    Effacer
                  </Link>
                )}
              </div>
            </form>

            <section className="card" aria-labelledby="em-log-h">
              <div className="card-h">
                <h2 id="em-log-h">
                  {log.length} envoi{log.length > 1 ? "s" : ""}
                  {filtered ? " trouvé" + (log.length > 1 ? "s" : "") : ""}
                </h2>
                <span className="muted">{failed ? `${failed} en échec` : "Les 200 derniers"}</span>
              </div>
              {loadError && <p className="muted">Lecture du journal impossible : {loadError}</p>}
              <ul className="em-log">
                {log.map((e) => (
                  <li key={e.id}>
                    <span>
                      <b>{e.subject || label(e.template)}</b>
                      <span className="em-meta">
                        {e.toEmail} · {label(e.template)} · {e.provider}
                        {e.attachments.length ? ` · ${e.attachments.length} pièce${e.attachments.length > 1 ? "s" : ""} jointe${e.attachments.length > 1 ? "s" : ""}` : ""}
                        {e.resentFrom ? " · renvoi" : ""}
                      </span>
                      {e.error && <span className="em-err">{e.error}</span>}
                    </span>
                    <span className="em-side">
                      <span className={"em-status" + (e.status === "failed" ? " failed" : "")}>{e.status === "sent" ? "Envoyé" : "Échec"}</span>
                      <time dateTime={e.createdAt}>
                        {dayMonthShort(e.createdAt)} · {hour(e.createdAt)}
                      </time>
                      <ResendEmailButton id={e.id} disabled={Object.keys(e.data).length ? null : "Contenu non conservé (compte supprimé)"} />
                    </span>
                  </li>
                ))}
                {!log.length && !loadError && <li className="empty">{filtered ? "Aucun envoi ne correspond à ces filtres." : "Aucun e-mail envoyé pour l’instant."}</li>}
              </ul>
            </section>
          </div>

          <div className="em-col">
            <section className="card" aria-labelledby="em-conf-h">
              <div className="card-h">
                <h2 id="em-conf-h">Configuration</h2>
                <span className="chip">{provider === "resend" ? "Resend" : provider === "smtp" ? "SMTP" : "Console"}</span>
              </div>
              <ul className="em-checks">
                {checks.map(([good, title, detail]) => (
                  <li key={title}>
                    <Icon name={good ? "check" : "clock"} />
                    <span>
                      {title}
                      <span>{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="em-tpl-h">
              <div className="card-h">
                <h2 id="em-tpl-h">Modèles à relire</h2>
                <span className="muted">{TEMPLATE_IDS.length} modèles</span>
              </div>
              <ul className="em-templates">
                {TEMPLATE_IDS.map((id) => (
                  <li key={id}>
                    <Link href={`/fondatrices/emails/apercu/${id}`}>
                      <b>{TEMPLATES[id].label}</b>
                      <span className="chip">{TEMPLATES[id].essential ? "Essentiel" : "Désinscription"}</span>
                      <small>{TEMPLATES[id].description}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
