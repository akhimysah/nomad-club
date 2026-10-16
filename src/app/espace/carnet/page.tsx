import type { Metadata } from "next";
import { Carnet } from "@/components/member/Carnet";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { PLACE_FILTERS, type PlaceFilterKey } from "@/lib/content";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Carnet d’adresses" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ filtre?: string }> };

export default async function CarnetPage({ searchParams }: Props) {
  await requireMember();
  const { filtre } = await searchParams;
  const initial = (PLACE_FILTERS.find((f) => f.key === filtre)?.key ?? "tout") as PlaceFilterKey;
  const places = await getRepo().listPlaces();
  return (
    <Screen group="member" index={3} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Carnet d’adresses</div>
            <h1 className="scr-title">Le carnet du club</h1>
            <p className="scr-sub">Des lieux où le club est allé. Testés, pas sponsorisés.</p>
          </div>
        </div>
        <Carnet places={places} initial={initial} />
      </div>
    </Screen>
  );
}
