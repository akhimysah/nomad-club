import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { AgendaSection } from "@/components/visit/sections";
import { getViewer } from "@/lib/auth";
import { upcomingFor } from "@/lib/views";

export const metadata: Metadata = { title: "Prochains rendez-vous" };
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const viewer = await getViewer();
  const { events, mine } = await upcomingFor(viewer);
  return (
    <Screen group="visit" index={1} className="vscreen on" mobileOnly>
      <AgendaSection events={events} mine={mine} hasAccount={!!viewer.profile} />
    </Screen>
  );
}
