import type { Metadata } from "next";
import { FHead, Summary, TodoGroups } from "@/components/founders/parts";
import { Screen } from "@/components/ui/Screen";
import { loadDashboard } from "@/lib/founders-view";

export const metadata: Metadata = { title: "À traiter" };
export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const { d } = await loadDashboard();
  return (
    <Screen group="founders" index={1} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="À traiter" sub="Tout, groupé, en un geste" withNew />
        <Summary d={d} compact />
        <section className="card">
          <TodoGroups d={d} full />
        </section>
      </div>
    </Screen>
  );
}
