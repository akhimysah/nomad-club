import type { Metadata } from "next";
import Link from "next/link";
import { CommunauteTabs } from "@/components/communaute/CommunauteTabs";
import { NewsAdminList } from "@/components/communaute/NewsAdmin";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { communauteCounts } from "@/lib/modules/communaute/founders-view";
import { newsItems } from "@/lib/modules/communaute/views";

export const metadata: Metadata = { title: "Actualités" };
export const dynamic = "force-dynamic";

/** Lot 1 — Publications du club : brouillons, publication, épinglage. */
export default async function FounderNewsPage() {
  const v = await requireCapability("news.manage", { next: "/fondatrices/communaute/actualites" });
  const [posts, counts] = await Promise.all([getRepo().listNews({ viewerId: v.profile.id, includeDrafts: true }), communauteCounts()]);
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Actualités, groupes, modération</div>
            <h1 className="scr-title">Communauté</h1>
          </div>
          <Link className="btn btn-ink" href="/fondatrices/communaute/actualites/nouvelle">
            <Icon name="plus" />
            Nouvelle publication
          </Link>
        </div>
        <CommunauteTabs active="/fondatrices/communaute/actualites" counts={counts} />
        <NewsAdminList posts={newsItems(posts)} />
      </div>
    </Screen>
  );
}
