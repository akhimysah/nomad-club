import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/crm/ContactForm";
import { getViewer } from "@/lib/auth";
import { loadCrm } from "@/lib/modules/crm/load";

export const metadata: Metadata = { title: "Nouveau contact" };
export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const { owners } = await loadCrm();
  const v = await getViewer();
  return (
    <>
      <div className="crm-head">
        <div>
          <Link href="/fondatrices/crm/contacts" className="eyebrow">
            ← Contacts
          </Link>
          <h1>Nouveau contact</h1>
        </div>
      </div>
      <section className="card">
        <ContactForm
          id={null}
          owners={owners}
          initial={{
            kind: "person",
            firstName: "",
            lastName: "",
            company: "",
            job: "",
            email: "",
            phone: "",
            instagram: "",
            city: "Marrakech",
            source: "instagram",
            status: "prospect",
            tags: "",
            notes: "",
            marketingConsent: false,
            ownerId: v.profile?.id ?? "",
          }}
        />
      </section>
    </>
  );
}
