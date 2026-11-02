/**
 * Vague 2 · Contrats — mise en forme des contrats pour les écrans (Mes contrats, back-office, CRM).
 */
import type { MyContractItem } from "@/components/contrats/MyContracts";
import { dateLong, formatAmount } from "./domain";
import { CONTRACTS_HOME, KIND_LABEL, STATUS_LABEL } from "./labels";
import type { ContractView } from "./types";

export function amountLine(c: ContractView): string {
  if (c.kind === "partner") return "sans frais";
  if (c.kind === "pro") return `${formatAmount(c.amount, c.currency)} / mois`;
  return c.installments > 1 ? `${formatAmount(c.amount, c.currency)} en ${c.installments} fois` : formatAmount(c.amount, c.currency);
}

export function contractLine(c: ContractView): string {
  const who = c.organizationName ? `${c.organizationName} · ` : "";
  const when = c.status === "accepted" && c.acceptedAt ? `accepté le ${dateLong(c.acceptedAt.slice(0, 10))}` : c.status === "cancelled" ? "annulé" : `généré le ${dateLong(c.createdAt.slice(0, 10))}`;
  return `${who}${amountLine(c)} · ${when}`;
}

/** `base` : préfixe de l'espace qui sert les PDF (/espace/moi/contrats, /partenaire/contrats…). */
export function toMyItems(list: ContractView[], base?: string): MyContractItem[] {
  return list.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.templateTitle,
    kindLabel: KIND_LABEL[c.kind],
    status: c.status,
    statusLabel: STATUS_LABEL[c.status].label,
    statusCls: STATUS_LABEL[c.status].cls,
    line: contractLine(c),
    pdfUrl: `${base ?? CONTRACTS_HOME[c.kind]}/${c.id}/pdf`,
  }));
}
