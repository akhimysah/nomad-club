import type { Metadata } from "next";
import { Cercle, type CercleTab } from "@/components/member/Cercle";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { loadCercle } from "@/lib/cercle";

export const metadata: Metadata = { title: "Cercle" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ onglet?: string }> };

export default async function CerclePage({ searchParams }: Props) {
  const v = await requireMember();
  const { onglet } = await searchParams;
  const tab: CercleTab = onglet === "annuaire" || onglet === "messages" ? onglet : "salon";
  const data = (await loadCercle(v.profile, null))!;
  return (
    <Screen group="member" index={2} className="mscreen chat on">
      <Cercle tab={tab} demo={v.mode === "demo"} {...data} />
    </Screen>
  );
}
