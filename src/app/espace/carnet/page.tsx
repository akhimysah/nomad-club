import type { Metadata } from "next";
import { Carnet } from "@/components/member/Carnet";
import { CarnetTabs } from "@/components/partenaires/CarnetTabs";
import type { CarnetPro } from "@/components/partenaires/ProCard";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { PLACE_FILTERS, type PlaceFilterKey } from "@/lib/content";
import { getRepo } from "@/lib/data";
import { visibleEstablishments } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Carnet d’adresses" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ filtre?: string }> };

export default async function CarnetPage({ searchParams }: Props) {
  await requireMember();
  const { filtre } = await searchParams;
  const initial = (PLACE_FILTERS.find((f) => f.key === filtre)?.key ?? "tout") as PlaceFilterKey;
  // --- Lot 3 --- : adresses du club + annuaire (0002) + fiches des pros dont l'abonnement est actif
  const [places, establishments] = await Promise.all([getRepo().listPlaces(), visibleEstablishments()]);
  const pros: CarnetPro[] = establishments
    .filter((e) => e.listed)
    .map((e) => ({
      id: e.id, slug: e.slug, name: e.name, category: e.category, carnetCategory: e.details.carnetCategory, area: e.area, description: e.description,
      phone: e.phone, hours: e.details.hours, memberDiscount: e.details.memberDiscount, photo: e.details.photos[0] ?? null, featured: e.subscription?.plan === "vitrine",
    }));
  return (
    <Screen group="member" index={3} className="mscreen scroller on">
      <div className="m-inner">
        <CarnetTabs current="carnet" />
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Carnet d’adresses</div>
            <h1 className="scr-title">Le carnet du club</h1>
            <p className="scr-sub">Les lieux où le club est allé, les pros du réseau et l’annuaire pratique de Marrakech : santé, beauté, urgences, services.</p>
          </div>
        </div>
        <Carnet places={places} pros={pros} initial={initial} />
      </div>
    </Screen>
  );
}
