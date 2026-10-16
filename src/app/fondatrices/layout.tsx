import type { Metadata } from "next";
import { FounderChrome } from "@/components/founders/FounderChrome";
import { FounderHost } from "@/components/founders/FounderHost";
import { BodyClass } from "@/components/ui/BodyClass";
import { requireFounder } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { loadDashboard } from "@/lib/founders-view";

export const metadata: Metadata = { title: { default: "Espace fondatrices", template: "%s · Fondatrices" }, robots: { index: false } };

/** Espace fondatrices (version jour de la maquette) : réservé au rôle « founder ». */
export default async function FoundersLayout({ children }: { children: React.ReactNode }) {
  await requireFounder();
  const [{ d }, places, dir] = await Promise.all([loadDashboard(), getRepo().listPlaces(), getRepo().listDirectory()]);
  const founders = dir.filter((p) => p.role === "founder").map((p) => p.firstName);
  return (
    <section className="space day on" aria-label="Espace fondatrices">
      <BodyClass name="is-day" />
      <FounderHost places={places.map((p) => ({ id: p.id, name: p.name }))} minDate={today()}>
        <FounderChrome urgent={d.urgent} vir={d.counts.vir} names={founders.length ? founders.join(" et ") : "Fondatrices"} />
        <div className="f-main">{children}</div>
      </FounderHost>
    </section>
  );
}
