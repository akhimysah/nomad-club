import type { Metadata } from "next";
import { MemberChrome } from "@/components/member/MemberChrome";
import { requireMember, viewerCan, viewerSpaces } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName, PLAN_LABEL } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: { default: "Espace membre", template: "%s · Nomad Club" } };

/** Espace membre : réservé aux adhérentes (et aux fondatrices). */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const v = await requireMember();
  const repo = getRepo();
  const moderates = viewerCan(v, "messages.moderate"); // Lot 1
  const [unread, notifs, reports] = await Promise.all([
    repo.countUnreadDms(v.profile.id),
    repo.countUnreadNotifications(v.profile.id),
    moderates ? repo.countOpenReports() : Promise.resolve(undefined),
  ]);
  const formule = isAdmin(v.profile) ? "Fondatrice" : `Formule ${PLAN_LABEL[v.profile.plan]}`;
  return (
    <section className="space on" aria-label="Espace membre">
      <MemberChrome name={fullName(v.profile)} formule={formule} unread={unread} notifs={notifs} spaces={v.mode === "real" ? viewerSpaces(v) : []} moderation={reports} />
      <div className="m-main">{children}</div>
    </section>
  );
}
