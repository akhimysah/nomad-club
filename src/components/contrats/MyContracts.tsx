"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";
import { ContractStep } from "./ContractStep";

export type MyContractItem = {
  id: string;
  number: string;
  title: string;
  kindLabel: string;
  status: "pending" | "accepted" | "cancelled";
  statusLabel: string;
  statusCls: string;
  line: string;
  pdfUrl: string;
};

/** « Mes contrats » : liste, lecture et acceptation d'un contrat en attente, PDF et certificat. */
export function MyContracts({ items, empty }: { items: MyContractItem[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <>
      <div className="ct-list">
        {items.map((c) => (
          <div key={c.id} className="ct-row" id={`contrat-${c.id}`}>
            <span>
              <b>{c.title}</b>
              <span className="sub">
                {c.number} · {c.line}
              </span>
            </span>
            <span className="end">
              <span className={c.statusCls}>{c.statusLabel}</span>
              {c.status === "pending" ? (
                <button className="btn btn-gold btn-sm" type="button" onClick={() => setOpen(c.id)}>
                  <Icon name="edit" />
                  Lire et accepter
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(c.id)}>
                  Lire
                </button>
              )}
              <a className="btn btn-ghost btn-sm" href={c.pdfUrl} target="_blank" rel="noopener">
                PDF
              </a>
              {c.status === "accepted" && (
                <a className="btn btn-ghost btn-sm" href={`${c.pdfUrl}?certificat=1`} target="_blank" rel="noopener" title="Certificat d’acceptation (date, IP, empreinte)">
                  Certificat
                </a>
              )}
            </span>
          </div>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} label="Contrat">
        {open && (
          <ContractStep
            contractId={open}
            continueLabel="Accepter le contrat"
            onAccepted={() => {
              setOpen(null);
              toast("Contrat accepté. Ta copie PDF est disponible.", "check");
              router.refresh();
            }}
            onCancel={() => setOpen(null)}
          />
        )}
      </Sheet>
    </>
  );
}
