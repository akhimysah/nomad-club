import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractsTabs } from "@/components/contrats/AdminTabs";
import { ActivateTemplateButton } from "@/components/contrats/admin";
import { ContractDocument } from "@/components/contrats/ContractDocument";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dateLong } from "@/lib/modules/contrats/domain";
import { KIND_LONG } from "@/lib/modules/contrats/labels";
import { parseBlocks, placeholdersOf, unknownVariables } from "@/lib/modules/contrats/render";

export const metadata: Metadata = { title: "Modèle de contrat" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Vague 2 · Contrats — une version de modèle : texte avec notes internes, mentions à compléter, activation. */
export default async function TemplatePage({ params }: Props) {
  await requireCapability("contracts.manage", { next: "/fondatrices/contrats/modeles" });
  const { id } = await params;
  const repo = getRepo();
  const t = await repo.getContractTemplate(id);
  if (!t) notFound();
  const usedBy = (await repo.listContracts({ kind: t.kind })).filter((c) => c.templateId === t.id).length;
  const todo = placeholdersOf(t.bodyMd);
  const unknown = unknownVariables(t.bodyMd);
  return (
    <Screen group="founders" index={14} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={`${t.title} · v${t.version}`} sub={KIND_LONG[t.kind]} />
        <ContractsTabs on="templates" />
        <div className="f-grid">
          <section className="card">
            <ContractDocument blocks={parseBlocks(t.bodyMd)} notes />
          </section>
          <div className="f-col">
            <section className="card">
              <div className="card-h">
                <h2>Version {t.version}</h2>
                {t.active ? <span className="chip solid">Active</span> : <span className="chip">Inactive</span>}
              </div>
              <dl className="ct-kv">
                <dt>Mise en vigueur</dt>
                <dd>{dateLong(t.effectiveFrom)}</dd>
                <dt>Contrats</dt>
                <dd>{usedBy ? `${usedBy} contrat(s) utilisent cette version : son texte ne peut plus changer.` : "aucun"}</dd>
                {t.notes && (
                  <>
                    <dt>Notes</dt>
                    <dd>{t.notes}</dd>
                  </>
                )}
              </dl>
              <div className="btn-row" style={{ marginTop: 14 }}>
                {!t.active && <ActivateTemplateButton id={t.id} version={t.version} />}
                <Link className="btn btn-ghost btn-sm" href={`/fondatrices/contrats/modeles?nouvelle=${t.kind}&depuis=${t.id}`}>
                  <Icon name="plus" />
                  Nouvelle version à partir de celle-ci
                </Link>
              </div>
            </section>
            <section className="card">
              <div className="card-h">
                <h2>À compléter ({todo.length})</h2>
              </div>
              {todo.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5 }}>
                  {todo.map((p) => (
                    <li key={p}>[{p}]</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Aucune mention entre crochets.</p>
              )}
              {unknown.length > 0 && <p className="ct-msg err">Variables inconnues : {unknown.join(", ")}</p>}
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
