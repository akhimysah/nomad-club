import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SendTestEmailButton } from "@/components/emails/EmailButtons";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { prepareEmail } from "@/lib/modules/emails/service";
import { TEMPLATES } from "@/lib/modules/emails/templates";
import { isTemplateId } from "@/lib/modules/emails/types";
import { siteUrl } from "@/lib/site";
import "@/styles/emails.css";

export const metadata: Metadata = { title: "Aperçu d’un e-mail" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ modele: string }>; searchParams: Promise<{ vue?: string }> };

/** E-mails — aperçu d'un modèle avec ses données d'exemple (HTML, téléphone, texte brut), pour relecture par la cliente. */
export default async function EmailPreviewPage({ params, searchParams }: Props) {
  const { modele } = await params;
  if (!isTemplateId(modele)) notFound();
  const v = await requireCapability("space.admin", { next: `/fondatrices/emails/apercu/${modele}` });
  const { vue } = await searchParams;
  const view = vue === "texte" ? "texte" : vue === "telephone" ? "telephone" : "ordinateur";
  const t = TEMPLATES[modele];
  // données d'exemple, liens vers ce site, QR intégré en data: (la vraie version utilise cid:)
  const { rendered, attachments, unsubscribeUrl } = await prepareEmail(modele, t.sample, {
    profileId: t.essential ? null : "apercu",
    baseUrl: await siteUrl(),
    inlineAs: "data",
  });
  const files = attachments.filter((a) => !a.contentId).map((a) => a.filename);
  const idx = Object.keys(TEMPLATES).indexOf(modele);
  const ids = Object.keys(TEMPLATES);
  const prev = ids[(idx - 1 + ids.length) % ids.length];
  const next = ids[(idx + 1) % ids.length];
  const tab = (key: string, text: string) => (
    <Link className={"btn btn-sm " + (view === key ? "btn-ink" : "btn-ghost")} href={`/fondatrices/emails/apercu/${modele}${key === "ordinateur" ? "" : `?vue=${key}`}`} aria-current={view === key ? "page" : undefined}>
      {text}
    </Link>
  );

  return (
    <Screen group="founders" index={11} className="fscreen scroller on">
      <div className="f-inner">
        <p className="sec-back" style={{ padding: "0 0 6px", fontSize: 14 }}>
          <Link className="link" href="/fondatrices/emails">
            <Icon name="chev-l" /> E-mails
          </Link>
        </p>
        <FHead title={t.label} sub={`Aperçu · ${t.essential ? "e-mail essentiel" : "avec lien de désinscription"}`} />
        <section className="card">
          <div className="em-preview-head">
            <div className="em-subject">
              <span className="muted">Objet</span>
              <b>{rendered.subject}</b>
              <span className="muted">{rendered.preheader}</span>
            </div>
            <SendTestEmailButton template={modele} email={v.profile.email} />
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            {t.description} Données d’exemple. Identifiant : <code>{modele}</code>
            {unsubscribeUrl ? " · le lien de désinscription n’est pas actif dans l’aperçu" : ""}.
          </p>
          {files.length > 0 && (
            <ul className="em-files">
              {files.map((f) => (
                <li key={f}>Pièce jointe : {f}</li>
              ))}
            </ul>
          )}
          <div className="em-preview-head" style={{ marginTop: 16 }}>
            <div className="em-switch" role="group" aria-label="Affichage">
              {tab("ordinateur", "Ordinateur")}
              {tab("telephone", "Téléphone")}
              {tab("texte", "Texte brut")}
            </div>
            <div className="em-switch">
              <Link className="btn btn-ghost btn-sm" href={`/fondatrices/emails/apercu/${prev}`}>
                <Icon name="chev-l" /> Précédent
              </Link>
              <Link className="btn btn-ghost btn-sm" href={`/fondatrices/emails/apercu/${next}`}>
                Suivant <Icon name="chev-r" />
              </Link>
            </div>
          </div>
          {view === "texte" ? (
            <pre className="em-text">{rendered.text}</pre>
          ) : (
            <iframe title={`Aperçu : ${t.label}`} className={"em-frame" + (view === "telephone" ? " phone" : "")} srcDoc={rendered.html} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
          )}
        </section>
      </div>
    </Screen>
  );
}
