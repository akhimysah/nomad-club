import type { Metadata } from "next";
import { CarnetTabs } from "@/components/partenaires/CarnetTabs";
import { OffersBrowser, type OfferListItem } from "@/components/partenaires/OffersBrowser";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { visibleEstablishments } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Offres partenaires" };
export const dynamic = "force-dynamic";

/** Offres des partenaires du club (Lot 3). */
export default async function OffresPage() {
  await requireCapability("offers.view", { next: "/espace/offres", fallback: "/formules" });
  const [offers, places] = await Promise.all([getRepo().listOffers({ activeOnly: true }), visibleEstablishments()]);
  const items: OfferListItem[] = offers.flatMap((o) => {
    const e = places.find((p) => p.id === o.organizationId && p.kinds.includes("partner"));
    if (!e) return [];
    return [{
      id: o.id, title: o.title, badge: o.badge, detail: o.detail, audience: o.audience, validUntil: o.validUntil,
      orgName: e.name, orgSlug: e.slug, area: e.area, category: e.details.carnetCategory, photo: e.details.photos[0] ?? null,
    }];
  });
  return (
    <Screen group="member" index={3} className="mscreen scroller on">
      <div className="m-inner">
        <CarnetTabs current="offres" />
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Offres partenaires</div>
            <h1 className="scr-title">Les avantages du club</h1>
            <p className="scr-sub">Réductions et attentions de nos partenaires. Ouvre une offre, puis « Utiliser l’offre » au comptoir : ton code personnel s’affiche.</p>
          </div>
        </div>
        <OffersBrowser offers={items} />
      </div>
    </Screen>
  );
}
