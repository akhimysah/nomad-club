import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractsTabs } from "@/components/contrats/AdminTabs";
import { CancelContractForm, RemindButton } from "@/components/contrats/admin";
import { ContractDocument } from "@/components/contrats/ContractDocument";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dateLong, formatAmount } from "@/lib/modules/contrats/domain";
import { KIND_LONG, STATUS_LABEL } from "@/lib/modules/contrats/labels";
import { parseBlocks } from "@/lib/modules/contrats/render";
import { verifyContractHash } from "@/lib/modules/contrats/service";
import { amountLine } from "@/lib/modules/contrats/views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getRepo().getContract(id);
  return { title: c ? `Contrat ${c.number}` : "Contrat" };
}

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", dateStyle: "long", timeStyle: "medium" });

/** Vague 2 · Contrats — détail : informations, preuve d'acceptation, vérification de l'empreinte, relance, annulation. */
export default async function ContractAdminPage({ params }: Props) {
  await requireCapability("contracts.manage", { next: "/fondatrices/contrats" });
  const { id } = await params;
  const repo = getRepo();
  const c = await repo.getContract(id);
  if (!c) notFound();
  const [hashOk, crm] = await Promise.all([verifyContractHash(c), c.profileId ? repo.crmData().then((d) => d.contacts.find((x) => x.profileId === c.profileId) ?? null).catch(() => null) : Promise.resolve(null)]);
  const a = c.acceptance;
  const pdf = `/fondatrices/contrats/${c.id}/pdf`;
  return (
    <Screen group="founders" index={14} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={`Contrat ${c.number}`} sub={KIND_LONG[c.kind]} />
        <ContractsTabs on="list" />
        <div className="f-grid">
          <div className="f-col">
            <section className="card">
              <div className="card-h">
                <h2>Contrat</h2>
                <span className={STATUS_LABEL[c.status].cls}>{STATUS_LABEL[c.status].label}</span>
              </div>
              <dl className="ct-kv">
                <dt>Signataire</dt>
                <dd>
                  {c.signerName}
                  {crm && (
                    <>
                      {" · "}
                      <Link className="link" href={`/fondatrices/crm/contacts/${crm.id}`}>
                        fiche CRM
                      </Link>
                    </>
                  )}
                </dd>
                {c.organizationName && (
                  <>
                    <dt>Établissement</dt>
                    <dd>{c.organizationName}</dd>
                  </>
                )}
                <dt>Formule</dt>
                <dd>
                  {c.variables["formule.nom"] ?? c.plan} · {amountLine(c)}
                </dd>
                {c.schedule.length > 1 && (
                  <>
                    <dt>Échéancier</dt>
                    <dd>{c.schedule.map((s) => `${formatAmount(s.amount, c.currency)} le ${dateLong(s.dueOn)}`).join(" · ")}</dd>
                  </>
                )}
                <dt>Période</dt>
                <dd>
                  du {dateLong(c.startsOn)} {c.endsOn ? `au ${dateLong(c.endsOn)}` : "· mensuel, sans terme fixe"}
                </dd>
                <dt>Modèle</dt>
                <dd>
                  <Link className="link" href={`/fondatrices/contrats/modeles/${c.templateId}`}>
                    {c.templateTitle} · version {c.templateVersion}
                  </Link>
                </dd>
                <dt>Généré le</dt>
                <dd>
                  {when(c.createdAt)} · {c.source === "checkout" ? "étape « Contrat » du parcours" : c.source === "subscription" ? "après souscription" : c.source === "admin" ? "par les fondatrices" : "données d’exemple"}
                </dd>
                <dt>Souscription</dt>
                <dd>{c.subscriptionRef ?? "pas encore reliée à un paiement"}</dd>
                <dt>Empreinte SHA-256</dt>
                <dd>
                  <span className="ct-hash">{c.pdfSha256}</span>
                  <br />
                  <span style={{ fontSize: 13.5 }}>{hashOk ? "✓ le PDF correspond à l’empreinte enregistrée" : "⚠ le PDF régénéré ne correspond pas : voir le fichier déposé"}</span>
                </dd>
                {c.status === "pending" && (
                  <>
                    <dt>Relances</dt>
                    <dd>{c.reminderCount ? `${c.reminderCount} · dernière le ${when(c.remindedAt!)}` : "aucune"}</dd>
                  </>
                )}
                {c.status === "cancelled" && (
                  <>
                    <dt>Annulé le</dt>
                    <dd>
                      {c.cancelledAt ? when(c.cancelledAt) : "—"} · {c.cancelReason}
                    </dd>
                  </>
                )}
              </dl>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <a className="btn btn-ink btn-sm" href={pdf} target="_blank" rel="noopener">
                  <Icon name="book" />
                  PDF
                </a>
                {a && (
                  <a className="btn btn-ghost btn-sm" href={`${pdf}?certificat=1`} target="_blank" rel="noopener">
                    Certificat d’acceptation
                  </a>
                )}
                {c.status === "pending" && <RemindButton id={c.id} className="btn btn-ghost btn-sm" />}
                {c.status !== "cancelled" && <CancelContractForm id={c.id} accepted={c.status === "accepted"} />}
              </div>
            </section>

            <section className="card">
              <div className="card-h">
                <h2>Preuve d’acceptation</h2>
              </div>
              {a ? (
                <dl className="ct-kv">
                  <dt>Acceptée le</dt>
                  <dd>
                    {when(a.acceptedAt)} <span className="muted">({a.acceptedAt})</span>
                  </dd>
                  <dt>Par</dt>
                  <dd>
                    {a.signerName}
                    {a.signerEmail ? ` · ${a.signerEmail}` : ""}
                  </dd>
                  <dt>Adresse IP</dt>
                  <dd>{a.ip ?? "non relevée"}</dd>
                  <dt>Navigateur</dt>
                  <dd style={{ fontSize: 13.5 }}>{a.userAgent ?? "non relevé"}</dd>
                  <dt>Version du modèle</dt>
                  <dd>{a.templateVersion}</dd>
                  <dt>Empreinte acceptée</dt>
                  <dd>
                    <span className="ct-hash">{a.pdfSha256}</span>
                    {a.pdfSha256 === c.pdfSha256 ? " ✓" : " ⚠ différente"}
                  </dd>
                  <dt>Méthode</dt>
                  <dd>{a.provider === "simple" ? "Acceptation électronique simple (case à cocher)" : a.provider}</dd>
                  <dt>Phrase cochée</dt>
                  <dd>« {a.statement} »</dd>
                </dl>
              ) : (
                <div className="empty">
                  <Icon name="clock" />
                  Pas encore accepté{c.status === "cancelled" ? " (contrat annulé)" : ""}.
                </div>
              )}
              <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
                La preuve n’est jamais modifiable ni supprimable, même par une administratrice.
              </p>
            </section>
          </div>
          <section className="card" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <ContractDocument blocks={parseBlocks(c.bodyMd)} />
          </section>
        </div>
      </div>
    </Screen>
  );
}
