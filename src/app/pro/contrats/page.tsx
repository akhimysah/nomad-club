import type { Metadata } from "next";
import { OrgContractsScreen } from "@/components/contrats/OrgContracts";

export const metadata: Metadata = { title: "Contrat" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

/** Vague 2 · Contrats — contrat de référencement du carnet (lecture, acceptation, PDF, certificat). */
export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  return <OrgContractsScreen kind="pro" org={org} index={5} />;
}
