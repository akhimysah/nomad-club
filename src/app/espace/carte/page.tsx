import type { Metadata } from "next";
import { CarnetTabs } from "@/components/partenaires/CarnetTabs";
import { LocationForm } from "@/components/partenaires/LocationForm";
import { MapExplorer, type MapPin } from "@/components/partenaires/MapExplorer";
import { Screen } from "@/components/ui/Screen";
import { requireCapability, viewerCan } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { QUARTIERS } from "@/lib/modules/partenaires/domain";
import { visibleEstablishments } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Carte" };
export const dynamic = "force-dynamic";

/** Carte interactive : partenaires, pros du réseau et membres qui ont consenti (position approximative). */
export default async function CartePage() {
  const v = await requireCapability("map.view", { next: "/espace/carte", fallback: "/formules" });
  const repo = getRepo();
  const [places, members, offers, mine] = await Promise.all([visibleEstablishments(), repo.listMemberPins(), repo.listOffers({ activeOnly: true }), repo.getMemberLocation(v.profile.id)]);
  const pins: MapPin[] = [
    ...places.flatMap((e): MapPin[] => {
      if (e.lat == null || e.lng == null) return [];
      const partner = e.kinds.includes("partner");
      const best = offers.find((o) => o.organizationId === e.id);
      return [{
        id: e.id, kind: partner ? "partner" : "pro", lat: e.lat, lng: e.lng, kicker: partner ? (best ? `Offre ${best.badge}` : "Partenaire") : "Pro du réseau",
        title: e.name, subtitle: [e.category, e.area].filter(Boolean).join(" · "), category: e.details.carnetCategory, href: `/espace/fiche/${e.slug}`,
      }];
    }),
    ...members
      .filter((m) => m.profileId !== v.profile.id)
      .map((m, i): MapPin => ({
        id: `m-${m.profileId || i}`, kind: "member", lat: m.lat, lng: m.lng, kicker: "Membre", title: m.label,
        subtitle: [m.job, m.area ? `vers ${m.area}` : null].filter(Boolean).join(" · "), category: null, href: m.profileId ? `/espace/cercle/${m.profileId}` : null,
      })),
  ];
  return (
    <Screen group="member" index={3} className="mscreen scroller on">
      <div className="m-inner">
        <CarnetTabs current="carte" />
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Carte</div>
            <h1 className="scr-title">Marrakech, côté club</h1>
            <p className="scr-sub">Les partenaires et les pros du réseau, et les membres qui ont choisi d’apparaître (jamais à leur adresse exacte).</p>
          </div>
        </div>
        <MapExplorer pins={pins} />
        {viewerCan(v, "location.share") && (
          <div style={{ marginTop: 28, maxWidth: 720 }} id="ma-position">
            <LocationForm
              value={{ sharing: mine?.sharing ?? false, precision: mine?.precision ?? "area", display: mine?.display ?? "name", area: mine?.area ?? null, consentedAt: mine?.consentedAt ?? null }}
              areas={QUARTIERS.map((q) => q.name)}
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
