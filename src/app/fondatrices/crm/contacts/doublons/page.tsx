import type { Metadata } from "next";
import Link from "next/link";
import { MergePair } from "@/components/crm/MergePair";
import { StatusChip } from "@/components/crm/bits";
import { Icon } from "@/components/ui/Icon";
import { ymdShortYear } from "@/lib/format";
import { findDuplicates } from "@/lib/modules/crm/domain";
import { loadCrm } from "@/lib/modules/crm/load";
import { ymdOf } from "@/lib/clock";

export const metadata: Metadata = { title: "Doublons" };
export const dynamic = "force-dynamic";

/** Doublons probables (même e-mail, téléphone ou nom) : fusion en un clic, la fiche reliée à un compte est gardée. */
export default async function DuplicatesPage() {
  const { rows } = await loadCrm();
  const groups = findDuplicates(rows);
  return (
    <>
      <div className="crm-head">
        <div>
          <Link href="/fondatrices/crm/contacts" className="eyebrow">
            ← Contacts
          </Link>
          <h1>Doublons probables</h1>
        </div>
      </div>
      {!groups.length && (
        <div className="empty">
          <Icon name="check" />
          Aucun doublon : chaque personne a une seule fiche.
        </div>
      )}
      <div className="ccol">
        {groups.map((g) => {
          // garder la fiche reliée à un compte, sinon la plus ancienne
          const sorted = [...g.rows].sort((a, b) => (!!a.profile === !!b.profile ? a.contact.createdAt.localeCompare(b.contact.createdAt) : a.profile ? -1 : 1));
          const keep = sorted[0];
          return (
            <section key={g.rows.map((r) => r.contact.id).join("|")} className="card">
              <div className="card-h">
                <h2>{keep.name}</h2>
                <span className="muted">{g.reason}</span>
              </div>
              <table className="ctable">
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={r.contact.id}>
                      <td>
                        <Link href={`/fondatrices/crm/contacts/${r.contact.id}`}>
                          <b>{r.name}</b>
                        </Link>
                        {i === 0 && <span className="tag" style={{ marginLeft: 8 }}>gardée</span>}
                      </td>
                      <td>
                        <StatusChip status={r.status} />
                      </td>
                      <td className="muted hide-m">{r.email ?? r.phone ?? "—"}</td>
                      <td className="muted hide-m">{r.profile ? "compte de l’appli" : "sans compte"}</td>
                      <td className="muted hide-m">ajoutée le {ymdShortYear(ymdOf(r.contact.createdAt))}</td>
                      <td className="num">{i > 0 && <MergePair keepId={keep.contact.id} dropId={r.contact.id} label={`Verser dans « ${keep.name} »`} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </>
  );
}
