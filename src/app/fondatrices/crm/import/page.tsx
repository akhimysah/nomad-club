import type { Metadata } from "next";
import Link from "next/link";
import { ImportWizard } from "@/components/crm/ImportWizard";
import { getViewer } from "@/lib/auth";
import { loadCrm } from "@/lib/modules/crm/load";

export const metadata: Metadata = { title: "Importer des contacts" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { rows, owners } = await loadCrm();
  const v = await getViewer();
  // pour signaler les doublons dans l'aperçu (e-mails et 9 derniers chiffres des téléphones)
  const emails = rows.map((r) => r.email?.trim().toLowerCase()).filter((x): x is string => !!x);
  const phones = rows.map((r) => (r.phone ?? "").replace(/\D/g, "").slice(-9)).filter((x) => x.length >= 8);
  return (
    <>
      <div className="crm-head">
        <div>
          <Link href="/fondatrices/crm/contacts" className="eyebrow">
            ← Contacts
          </Link>
          <h1>Importer des contacts</h1>
        </div>
      </div>
      <ImportWizard emails={emails} phones={phones} owners={owners} me={v.profile?.id ?? ""} />
    </>
  );
}
