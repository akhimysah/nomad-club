import type { Metadata } from "next";
import { CommunauteTabs } from "@/components/communaute/CommunauteTabs";
import { GroupRequests, GroupsManager } from "@/components/communaute/GroupAdmin";
import { FHead } from "@/components/founders/parts";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { communauteCounts } from "@/lib/modules/communaute/founders-view";
import { loadModeration } from "@/lib/modules/communaute/views";

export const metadata: Metadata = { title: "Groupes" };
export const dynamic = "force-dynamic";

/** Lot 1 — Groupes thématiques : demandes, création, modification, archivage. */
export default async function FounderGroupsPage() {
  const v = await requireCapability("groups.manage", { next: "/fondatrices/communaute/groupes" });
  const [groups, mod, counts] = await Promise.all([getRepo().listGroups(v.profile.id, { manage: true }), loadModeration(v.profile.id), communauteCounts()]);
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Communauté" sub="Actualités, groupes, modération" />
        <CommunauteTabs active="/fondatrices/communaute/groupes" counts={counts} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <GroupRequests requests={mod.requests} />
          <GroupsManager groups={groups} readLinks={v.mode === "real"} />
        </div>
      </div>
    </Screen>
  );
}
