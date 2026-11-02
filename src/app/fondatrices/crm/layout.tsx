import type { Metadata } from "next";
import { CrmNav } from "@/components/crm/CrmNav";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { taskBuckets } from "@/lib/modules/crm/domain";
import { loadCrm, remindDueTasks } from "@/lib/modules/crm/load";
import "@/styles/crm.css";

export const metadata: Metadata = { title: { default: "CRM", template: "%s · CRM" } };
export const dynamic = "force-dynamic";

/** CRM (Lot 5) : réservé à crm.access (administratrices). Rappelle au passage les tâches du jour de la personne. */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const v = await requireCapability("crm.access", { next: "/fondatrices/crm" });
  await remindDueTasks(v.profile.id);
  const { data, today } = await loadCrm();
  const b = taskBuckets(data.tasks, today, v.profile.id);
  return (
    <Screen group="founders" index={5} className="fscreen scroller on">
      <div className="f-inner crm">
        <CrmNav tasksDue={b.overdue.length + b.today.length} />
        {children}
      </div>
    </Screen>
  );
}
