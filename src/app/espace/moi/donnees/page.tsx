import type { Metadata } from "next";
import Link from "next/link";
import { MyDataBody } from "@/components/securite/MyDataBody";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Mes données" };
export const dynamic = "force-dynamic";

/** Lot 6 — Mes données (RGPD) dans l'espace membre. */
export default async function MyDataPage() {
  const v = await requireMember("/espace/moi/donnees");
  return (
    <Screen group="member" index={5} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <Link href="/espace/moi" className="link sec-back">
              <Icon name="chev-l" />
              Moi
            </Link>
            <h1 className="scr-title">Mes données</h1>
            <p className="scr-sub">Ce que le club sait de toi, ce que tu acceptes, et comment tout reprendre.</p>
          </div>
        </div>
        <MyDataBody viewer={v} profile={v.profile} exportHref="/espace/moi/donnees/export" />
      </div>
    </Screen>
  );
}
