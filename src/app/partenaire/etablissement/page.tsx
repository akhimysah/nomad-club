import type { Metadata } from "next";
import { OrgSheetScreen } from "@/components/partenaires/OrgScreens";

export const metadata: Metadata = { title: "Établissement" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string; org?: string }> };

export default async function Page({ searchParams }: Props) {
  const { id, org } = await searchParams;
  return <OrgSheetScreen kind="partner" org={org ?? id} index={4} />;
}
