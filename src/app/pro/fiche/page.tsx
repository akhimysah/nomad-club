import type { Metadata } from "next";
import { OrgSheetScreen } from "@/components/partenaires/OrgScreens";

export const metadata: Metadata = { title: "Ma fiche" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string; org?: string }> };

export default async function Page({ searchParams }: Props) {
  const { id, org } = await searchParams;
  return <OrgSheetScreen kind="pro" org={org ?? id} index={1} />;
}
