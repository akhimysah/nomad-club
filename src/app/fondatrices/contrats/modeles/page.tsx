import type { Metadata } from "next";
import Link from "next/link";
import { ContractsTabs } from "@/components/contrats/AdminTabs";
import { TemplateEditor } from "@/components/contrats/admin";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dateLong } from "@/lib/modules/contrats/domain";
import { KIND_LABEL, KIND_LONG } from "@/lib/modules/contrats/labels";
import { placeholdersOf } from "@/lib/modules/contrats/render";
import { CONTRACT_VARIABLES } from "@/lib/modules/contrats/templates";
import { CONTRACT_KINDS, type ContractKind } from "@/lib/modules/contrats/types";

export const metadata: Metadata = { title: "Modèles de contrat" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ nouvelle?: string; depuis?: string }> };

/** Vague 2 · Contrats — modèles versionnés : versions par type, activation, nouvelle version. */
export default async function TemplatesPage({ searchParams }: Props) {
  await requireCapability("contracts.manage", { next: "/fondatrices/contrats/modeles" });
  const sp = await searchParams;
  const repo = getRepo();
  const [templates, contracts] = await Promise.all([repo.listContractTemplates(), repo.listContracts()]);
  const used = new Map<string, number>();
  contracts.forEach((c) => used.set(c.templateId, (used.get(c.templateId) ?? 0) + 1));
  const newKind = (CONTRACT_KINDS as readonly string[]).includes(sp.nouvelle ?? "") ? (sp.nouvelle as ContractKind) : null;
  const source = newKind ? (templates.find((t) => t.id === sp.depuis && t.kind === newKind) ?? templates.find((t) => t.kind === newKind && t.active) ?? null) : null;

  return (
    <Screen group="founders" index={14} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Modèles de contrat" sub="Versions, mise en vigueur, activation" />
        <ContractsTabs on="templates" />
        <div className="ct-note draft" role="note" style={{ marginBottom: 18 }}>
          <Icon name="lock" />
          <span>BROUILLON — à faire valider par un juriste. Les textes fournis sont des points de départ : complétez les mentions entre crochets et faites-les relire avant la mise en production.</span>
        </div>
        {newKind && source ? (
          <section className="card">
            <div className="card-h">
              <h2>Nouvelle version · {KIND_LABEL[newKind]}</h2>
              <Link className="link" href="/fondatrices/contrats/modeles">
                Annuler
              </Link>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              À partir de la version {source.version}. La nouvelle version est enregistrée inactive : relisez l’aperçu, puis activez-la. Les contrats déjà générés gardent leur version.
            </p>
            <TemplateEditor kind={newKind} kindLabel={KIND_LONG[newKind]} initialTitle={source.title} initialBody={source.bodyMd} today={today()} variables={[...CONTRACT_VARIABLES]} />
          </section>
        ) : (
          <div className="f-col">
            {CONTRACT_KINDS.map((k) => {
              const versions = templates.filter((t) => t.kind === k);
              const active = versions.find((t) => t.active);
              const todo = active ? placeholdersOf(active.bodyMd).length : 0;
              return (
                <section className="card" key={k}>
                  <div className="card-h">
                    <h2>{KIND_LONG[k]}</h2>
                    <Link className="btn btn-ghost btn-sm" href={`/fondatrices/contrats/modeles?nouvelle=${k}`}>
                      <Icon name="plus" />
                      Nouvelle version
                    </Link>
                  </div>
                  {active && todo > 0 && (
                    <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
                      Version active : {todo} mention{todo > 1 ? "s" : ""} entre crochets encore à compléter.
                    </p>
                  )}
                  <div className="ct-list">
                    {versions.map((t) => (
                      <div className="ct-row" key={t.id}>
                        <span>
                          <b>
                            Version {t.version} · {t.title}
                          </b>
                          <span className="sub">
                            En vigueur le {dateLong(t.effectiveFrom)} · {used.get(t.id) ?? 0} contrat{(used.get(t.id) ?? 0) > 1 ? "s" : ""}
                            {t.notes ? ` · ${t.notes}` : ""}
                          </span>
                        </span>
                        <span className="end">
                          {t.active ? <span className="chip solid">Active</span> : <span className="chip">Inactive</span>}
                          <Link className="btn btn-ghost btn-sm" href={`/fondatrices/contrats/modeles/${t.id}`}>
                            Lire
                          </Link>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
