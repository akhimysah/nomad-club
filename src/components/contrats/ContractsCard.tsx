import Link from "next/link";
import { getRepo } from "@/lib/data";
import { STATUS_LABEL } from "@/lib/modules/contrats/labels";
import type { ContractKind } from "@/lib/modules/contrats/types";
import { contractLine } from "@/lib/modules/contrats/views";
import { Icon } from "../ui/Icon";

/** Encart « Contrat » des accueils Partenaire et Pro : dernier contrat de l'établissement et lien vers « Contrats ». */
export async function ContractsCard({ kind, organizationId, profileId, href, title }: { kind: ContractKind; organizationId: string; profileId: string; href: string; title: string }) {
  const list = (await getRepo().listMyContracts(profileId)).filter((c) => c.kind === kind && c.organizationId === organizationId);
  const last = list.find((c) => c.status !== "cancelled") ?? list[0] ?? null;
  return (
    <section className="card" id="contrats">
      <div className="card-h">
        <h2>{title}</h2>
        {last && <span className={STATUS_LABEL[last.status].cls}>{STATUS_LABEL[last.status].label}</span>}
      </div>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 15 }}>
        {last ? `${last.number} · ${contractLine(last)}` : "Aucun contrat pour l’instant : il se prépare et s’accepte en ligne."}
      </p>
      <Link className={"btn btn-sm " + (last?.status === "pending" || !last ? "btn-ink" : "btn-ghost")} href={href}>
        <Icon name="edit" />
        {last?.status === "pending" ? "Lire et accepter" : last ? "Voir le contrat" : "Voir les contrats"}
      </Link>
    </section>
  );
}
