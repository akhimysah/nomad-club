import type { Metadata } from "next";
import { MemberChrome } from "@/components/member/MemberChrome";
import { requireMember } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName, PLAN_LABEL } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: { default: "Espace membre", template: "%s · Nomad Club" } };

/** Espace membre : réservé aux adhérentes (et aux fondatrices). */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const v = await requireMember();
  const unread = await getRepo().countUnreadDms(v.profile.id);
  const formule = isAdmin(v.profile) ? "Fondatrice" : `Formule ${PLAN_LABEL[v.profile.plan]}`;
  return (
    <section className="space on" aria-label="Espace membre">
      <MemberChrome name={fullName(v.profile)} formule={formule} unread={unread} />
      <div className="m-main">{children}</div>
    </section>
  );
}
