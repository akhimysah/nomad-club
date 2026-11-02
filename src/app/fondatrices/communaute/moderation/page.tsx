import type { Metadata } from "next";
import { CommunauteTabs } from "@/components/communaute/CommunauteTabs";
import { KeywordsManager, ModerationQueue } from "@/components/communaute/Moderation";
import { FHead } from "@/components/founders/parts";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { communauteCounts } from "@/lib/modules/communaute/founders-view";
import { loadModeration } from "@/lib/modules/communaute/views";

export const metadata: Metadata = { title: "Modération" };
export const dynamic = "force-dynamic";

/** Lot 1 — File de modération et mots-clés (espace fondatrices). */
export default async function FounderModerationPage() {
  const v = await requireCapability("messages.moderate", { next: "/fondatrices/communaute/moderation" });
  const [mod, counts] = await Promise.all([loadModeration(v.profile.id), communauteCounts()]);
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Communauté" sub="Actualités, groupes, modération" />
        <CommunauteTabs active="/fondatrices/communaute/moderation" counts={counts} />
        <div className="moi-grid" style={{ alignItems: "start" }}>
          <div>
            <ModerationQueue open={mod.open} resolved={mod.resolved} />
          </div>
          <KeywordsManager keywords={mod.keywords} />
        </div>
      </div>
    </Screen>
  );
}
