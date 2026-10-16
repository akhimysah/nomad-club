import { VFoot } from "@/components/visit/sections";
import { VisitScroller, VNav, VTabbar } from "@/components/visit/VisitChrome";
import { isRealMode } from "@/lib/env";

/** Espace Compte gratuit (visiteuse) : barre du haut, pages, pied de page et barre du bas sur téléphone. */
export default function VisitLayout({ children }: { children: React.ReactNode }) {
  const demo = !isRealMode();
  return (
    <section className="space on" aria-label="Compte gratuit">
      <VisitScroller>
        <VNav demo={demo} />
        {children}
        <VFoot demo={demo} />
      </VisitScroller>
      <VTabbar demo={demo} />
    </section>
  );
}
