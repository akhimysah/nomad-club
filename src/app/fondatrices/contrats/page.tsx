import type { Metadata } from "next";
import Link from "next/link";
import { ContractsTabs } from "@/components/contrats/AdminTabs";
import { RemindButton } from "@/components/contrats/admin";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dateLong } from "@/lib/modules/contrats/domain";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/modules/contrats/labels";
import { CONTRACT_KINDS, CONTRACT_STATUSES, type ContractFilters, type ContractKind, type ContractStatus } from "@/lib/modules/contrats/types";
import { amountLine } from "@/lib/modules/contrats/views";

export const metadata: Metadata = { title: "Contrats" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ type?: string; statut?: string; du?: string; au?: string }> };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Vague 2 · Contrats — back-office : liste filtrable (type, statut, période), relances. */
export default async function ContractsAdminPage({ searchParams }: Props) {
  await requireCapability("contracts.manage", { next: "/fondatrices/contrats" });
  const sp = await searchParams;
  const filters: ContractFilters = {
    kind: (CONTRACT_KINDS as readonly string[]).includes(sp.type ?? "") ? (sp.type as ContractKind) : undefined,
    status: (CONTRACT_STATUSES as readonly string[]).includes(sp.statut ?? "") ? (sp.statut as ContractStatus) : undefined,
    from: YMD.test(sp.du ?? "") ? sp.du : undefined,
    to: YMD.test(sp.au ?? "") ? sp.au : undefined,
  };
  const repo = getRepo();
  const [list, all, templates] = await Promise.all([repo.listContracts(filters), repo.listContracts(), repo.listContractTemplates()]);
  const pending = all.filter((c) => c.status === "pending");
  const month = today().slice(0, 7);
  const acceptedMonth = all.filter((c) => c.acceptedAt?.slice(0, 7) === month).length;
  return (
    <Screen group="founders" index={14} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Contrats" sub="Adhésions, partenaires, carnet pro" />
        <ContractsTabs on="list" />
        <div className="kpis">
          <div className="card kpi">
            <span className="lbl">
              <Icon name="edit" />
              Contrats
            </span>
            <div className="val">{all.length}</div>
          </div>
          <div className={"card kpi" + (pending.length ? " urgent" : "")}>
            <span className="lbl">
              <Icon name="clock" />À accepter
            </span>
            <div className="val">{pending.length}</div>
            <div className="sub">en attente de la signataire</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="check" />
              Acceptés ce mois-ci
            </span>
            <div className="val">{acceptedMonth}</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="book" />
              Modèles actifs
            </span>
            <div className="val">{templates.filter((t) => t.active).length}</div>
            <div className="sub">brouillons à faire valider</div>
          </div>
        </div>

        <section className="card">
          <form className="ct-filters" method="get">
            <label>
              Type
              <select name="type" defaultValue={filters.kind ?? ""}>
                <option value="">Tous</option>
                {CONTRACT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Statut
              <select name="statut" defaultValue={filters.status ?? ""}>
                <option value="">Tous</option>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Du
              <input type="date" name="du" defaultValue={filters.from ?? ""} />
            </label>
            <label>
              Au
              <input type="date" name="au" defaultValue={filters.to ?? ""} />
            </label>
            <button className="btn btn-ink btn-sm" type="submit">
              Filtrer
            </button>
            {(filters.kind || filters.status || filters.from || filters.to) && (
              <Link className="btn btn-ghost btn-sm" href="/fondatrices/contrats">
                Effacer
              </Link>
            )}
          </form>
          {list.length ? (
            <div className="table-scroll">
              <table className="stat-table plain ct-table">
                <thead>
                  <tr>
                    <th>Contrat</th>
                    <th>Type</th>
                    <th>Signataire</th>
                    <th>Formule · montant</th>
                    <th>Généré le</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link className="link" href={`/fondatrices/contrats/${c.id}`}>
                          {c.number}
                        </Link>
                        <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                          modèle v{c.templateVersion}
                        </span>
                      </td>
                      <td>{KIND_LABEL[c.kind]}</td>
                      <td className="wrap">
                        {c.signerName}
                        {c.organizationName && (
                          <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                            {c.organizationName}
                          </span>
                        )}
                      </td>
                      <td>{amountLine(c)}</td>
                      <td>{dateLong(c.createdAt.slice(0, 10))}</td>
                      <td>
                        <span className={STATUS_LABEL[c.status].cls}>{STATUS_LABEL[c.status].label}</span>
                      </td>
                      <td>{c.status === "pending" && <RemindButton id={c.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Aucun contrat pour ces filtres.</div>
          )}
        </section>
      </div>
    </Screen>
  );
}
