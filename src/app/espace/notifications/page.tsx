import type { Metadata } from "next";
import { NotificationsBody } from "@/components/notifications/NotificationsPage";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function MemberNotificationsPage() {
  const v = await requireMember("/espace/notifications");
  return (
    <Screen group="member" index={6} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Ton activité</div>
            <h1 className="scr-title">Notifications</h1>
            <p className="scr-sub">Réservations, places libérées, nouveaux rendez-vous et paiements validés.</p>
          </div>
        </div>
        <NotificationsBody profileId={v.profile.id} />
      </div>
    </Screen>
  );
}
