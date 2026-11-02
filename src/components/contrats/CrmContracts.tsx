import Link from "next/link";
import { getRepo } from "@/lib/data";
import { STATUS_LABEL } from "@/lib/modules/contrats/labels";
import { contractLine } from "@/lib/modules/contrats/views";
import { Icon } from "../ui/Icon";
import { RemindButton } from "./admin";
import "@/styles/contrats.css";

/** Section « Contrats » de la fiche contact du CRM : contrats de la personne et de son établissement. */
export async function CrmContracts({ profileId, organizationId }: { profileId: string | null; organizationId: string | null }) {
  const repo = getRepo();
  const [mine, org] = await Promise.all([
    profileId ? repo.listContracts({ profileId }) : Promise.resolve([]),
    organizationId ? repo.listContracts({ organizationId }) : Promise.resolve([]),
  ]);
  const list = [...new Map([...mine, ...org].map((c) => [c.id, c])).values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const q = new URLSearchParams();
  if (profileId) q.set("profil", profileId);
  if (organizationId) q.set("org", organizationId);
  return (
    <>
      {list.length ? (
        <div className="ct-list">
          {list.map((c) => (
            <div key={c.id} className="ct-row">
              <span>
                <Link className="link" href={`/fondatrices/contrats/${c.id}`}>
                  <b>{c.templateTitle}</b>
                </Link>
                <span className="sub">
                  {c.number} · v{c.templateVersion} · {contractLine(c)}
                </span>
              </span>
              <span className="end">
                <span className={STATUS_LABEL[c.status].cls}>{STATUS_LABEL[c.status].label}</span>
                {c.status === "pending" && <RemindButton id={c.id} />}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Icon name="lock" />
          Aucun contrat pour ce contact.
        </div>
      )}
      {(profileId || organizationId) && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Link className="btn btn-ghost btn-sm" href={`/fondatrices/contrats/nouveau?${q.toString()}`}>
            <Icon name="plus" />
            Générer un contrat
          </Link>
        </div>
      )}
    </>
  );
}
