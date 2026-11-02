import Link from "next/link";
import { getRepo } from "@/lib/data";
import { ymdShortYear } from "@/lib/format";
import { formatMoney } from "@/lib/modules/paiements/money";
import { planView } from "@/lib/modules/paiements/views";
import { Icon } from "../ui/Icon";

/** Vague 2 · paiements — état de l'échéancier en cours sur la carte « Mon adhésion » (à jour, en retard, suspendu). */
export async function MembershipNote({ profileId }: { profileId: string }) {
  const plans = (await getRepo().payListPlans({ profileId }).catch(() => [])).map((p) => planView(p)).filter((p) => p.count > 1 && p.status !== "completed" && p.status !== "cancelled" && p.status !== "pending");
  const p = plans[0];
  if (!p) return null;
  const paid = p.installments.filter((i) => i.paid).length;
  const next = p.installments.find((i) => !i.paid);
  const late = p.status === "late" || p.status === "suspended";
  return (
    <div className="kv" style={{ gridTemplateColumns: "1fr" }}>
      <span>
        {late ? <Icon name="bell" /> : null} Paiement en {p.count} fois · {paid}/{p.count} échéances réglées
        {next ? ` · ${late ? "en retard" : `prochaine le ${ymdShortYear(next.dueDate)}`} : ${formatMoney(next.amount)}` : ""}
        {p.status === "late" && p.graceEndsOn ? ` · accès maintenu jusqu’au ${ymdShortYear(p.graceEndsOn)}` : ""}
      </span>
      <Link className="link" href="/espace/paiements">
        Voir mes échéances et mes reçus
      </Link>
    </div>
  );
}
