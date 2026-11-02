import type { Metadata } from "next";
import { OrgStatsScreen } from "@/components/partenaires/OrgScreens";

export const metadata: Metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  return <OrgStatsScreen kind="partner" org={org} index={3} />;
}
