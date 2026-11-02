import type { Metadata } from "next";
import { NewsFeed } from "@/components/communaute/NewsFeed";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { newsItems } from "@/lib/modules/communaute/views";

export const metadata: Metadata = { title: "Actualités" };
export const dynamic = "force-dynamic";

/** Lot 1 — Fil d'actualités du club (côté membre). */
export default async function NewsPage() {
  const v = await requireMember("/espace/actualites");
  const posts = await getRepo().listNews({ viewerId: v.profile.id });
  return (
    <Screen group="member" index={6} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Actualités</div>
            <h1 className="scr-title">Les nouvelles du club</h1>
            <p className="scr-sub">Les annonces de Julia et Nora, les retours de rendez-vous et les offres du moment.</p>
          </div>
        </div>
        <NewsFeed posts={newsItems(posts)} />
      </div>
    </Screen>
  );
}
