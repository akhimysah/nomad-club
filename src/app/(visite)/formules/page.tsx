import type { Metadata } from "next";
import { applyHrefFor } from "@/lib/modules/lancement/server"; // --- Lancement ---
import { Screen } from "@/components/ui/Screen";
import { FormulesSection } from "@/components/visit/sections";
import { getViewer } from "@/lib/auth";
import { payEnv, upcomingFor } from "@/lib/views";

export const metadata: Metadata = { title: "Formules" };
export const dynamic = "force-dynamic";

export default async function FormulesPage() {
  const viewer = await getViewer();
  const { events } = await upcomingFor(viewer);
  return (
    <Screen group="visit" index={3} className="vscreen on" mobileOnly>
      <FormulesSection env={payEnv(viewer)} needLogin={viewer.mode === "real" && !viewer.profile} nextPremium={events.find((e) => e.premiumFree) ?? null} applyHref={await applyHrefFor(viewer.profile) /* --- Lancement --- */} signupHref={viewer.mode === "real" && !viewer.profile ? "/inscription" : null} />
    </Screen>
  );
}
