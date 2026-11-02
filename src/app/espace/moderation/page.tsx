import type { Metadata } from "next";
import Link from "next/link";
import { GroupRequests, GroupsManager } from "@/components/communaute/GroupAdmin";
import { KeywordsManager, ModerationQueue } from "@/components/communaute/Moderation";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { loadModeration } from "@/lib/modules/communaute/views";

export const metadata: Metadata = { title: "Modération" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ onglet?: string }> };

/** Lot 1 — Espace des modératrices : signalements, mots-clés, groupes et demandes. */
export default async function MemberModerationPage({ searchParams }: Props) {
  const v = await requireCapability("messages.moderate", { next: "/espace/moderation", fallback: "/espace" });
  const tab = (await searchParams).onglet === "groupes" ? "groupes" : "signalements";
  const [mod, groups] = await Promise.all([loadModeration(v.profile.id), tab === "groupes" ? getRepo().listGroups(v.profile.id, { manage: true }) : Promise.resolve([])]);
  return (
    <Screen group="member" index={7} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Modération</div>
            <h1 className="scr-title">Veiller sur le cercle</h1>
            <p className="scr-sub">Les signalements des membres et des mots-clés, et les groupes thématiques.</p>
          </div>
        </div>
        <nav className="seg-chips" aria-label="Modération">
          <Link href="/espace/moderation" className={"seg-chip" + (tab === "signalements" ? " on" : "")}>
            Signalements {mod.open.length > 0 && <b>{mod.open.length}</b>}
          </Link>
          <Link href="/espace/moderation?onglet=groupes" className={"seg-chip" + (tab === "groupes" ? " on" : "")}>
            Groupes {mod.requests.length > 0 && <b>{mod.requests.length}</b>}
          </Link>
        </nav>
        {tab === "signalements" ? (
          <div className="moi-grid" style={{ alignItems: "start" }}>
            <div>
              <ModerationQueue open={mod.open} resolved={mod.resolved} />
            </div>
            <KeywordsManager keywords={mod.keywords} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <GroupRequests requests={mod.requests} />
            <GroupsManager groups={groups} readLinks />
          </div>
        )}
      </div>
    </Screen>
  );
}
