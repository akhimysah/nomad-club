import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { ClubSection } from "@/components/visit/sections";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Le club" };
export const dynamic = "force-dynamic";

export default async function ClubPage() {
  const memories = await getRepo().listMemories();
  return (
    <Screen group="visit" index={2} className="vscreen on" mobileOnly>
      <ClubSection memories={memories} />
    </Screen>
  );
}
