import type { Metadata } from "next";
import { OrgContractsScreen } from "@/components/contrats/OrgContracts";

export const metadata: Metadata = { title: "Contrats" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

/** Vague 2 · Contrats — contrat de partenariat de l'établissement (lecture, acceptation, PDF, certificat). */
export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  return <OrgContractsScreen kind="partner" org={org} index={6} />;
}
