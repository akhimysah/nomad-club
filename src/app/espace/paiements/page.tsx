import type { Metadata } from "next";
import { MyPaymentsBody } from "@/components/paiements/MyPaymentsBody";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Mes paiements" };
export const dynamic = "force-dynamic";

/** Vague 2 · paiements — « Mes paiements » dans l'espace membre (même contenu que /mes-paiements). */
export default async function MemberPaymentsPage() {
  const v = await requireMember();
  return (
    <Screen group="member" index={5} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Moi</div>
            <h1 className="scr-title">Mes paiements</h1>
          </div>
        </div>
        <MyPaymentsBody profileId={v.profile.id} demo={v.mode === "demo"} receiptBase="/espace/paiements/recu" />
      </div>
    </Screen>
  );
}
