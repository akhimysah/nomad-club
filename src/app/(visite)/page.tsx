import { Screen } from "@/components/ui/Screen";
import { AgendaSection, ClubSection, FormulesSection, Hero, MobileTeaser } from "@/components/visit/sections";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { activeMemberCount, featuredOf, payEnv, upcomingFor } from "@/lib/views";

export const dynamic = "force-dynamic";

/** Accueil : sur ordinateur, la longue page de la maquette ; sur téléphone, l'écran d'accueil de l'appli. */
export default async function HomePage() {
  const viewer = await getViewer();
  const [{ events, mine }, members, memories] = await Promise.all([upcomingFor(viewer), activeMemberCount(), getRepo().listMemories()]);
  const featured = featuredOf(events);
  const fm = featured ? (mine.get(featured.id) ?? null) : null;
  return (
    <>
      <Screen group="visit" index={0} className="vscreen on" mobileOnly>
        <Hero featured={featured} mine={fm} members={members.total} />
        <MobileTeaser featured={featured} mine={fm} />
      </Screen>
      <div className="desk-only">
        <AgendaSection events={events} mine={mine} hasAccount={!!viewer.profile} />
        <ClubSection memories={memories} />
        <FormulesSection env={payEnv(viewer)} needLogin={viewer.mode === "real" && !viewer.profile} nextPremium={events.find((e) => e.premiumFree) ?? null} />
      </div>
    </>
  );
}
