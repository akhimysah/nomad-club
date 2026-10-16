import type { Metadata } from "next";
import { MembersTable } from "@/components/founders/MembersTable";
import { FHead } from "@/components/founders/parts";
import { Screen } from "@/components/ui/Screen";
import { loadDashboard } from "@/lib/founders-view";

export const metadata: Metadata = { title: "Membres" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function MembersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const { d } = await loadDashboard();
  const rows = d.members.map((m) => ({ id: m.profile.id, name: m.name, job: m.profile.job ?? "", formule: m.formule, status: m.status, due: m.due, action: m.action }));
  return (
    <Screen group="founders" index={2} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Membres" sub={`${d.activeMembers} adhérentes actives · ${d.premiumMembers} Premium`} />
        <MembersTable rows={rows} initialQuery={q ?? ""} />
        <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>
          {d.members.length} fiches : adhérentes, adhésions échues et comptes gratuits.
        </p>
      </div>
    </Screen>
  );
}
