import type { Metadata } from "next";
import { FHead } from "@/components/founders/parts";
import { NotificationsBody } from "@/components/notifications/NotificationsPage";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const v = await requireCapability("space.pro", { next: "/pro/notifications", fallback: "/" });
  return (
    <Screen group="pro" index={2} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Notifications" sub="Ce qui te concerne" />
        <NotificationsBody profileId={v.profile.id} />
      </div>
    </Screen>
  );
}
