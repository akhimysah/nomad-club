import type { Metadata } from "next";
import { ShareLink } from "@/components/engagement/client";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthLong, plural } from "@/lib/format";
import { referralLink } from "@/lib/modules/engagement/referral";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Parrainage" };
export const dynamic = "force-dynamic";

/** Parrainage : mon code, mon lien, mes filleules et mes récompenses. */
export default async function ReferralPage() {
  const v = await requireCapability("referral.use", { next: "/espace/parrainage", fallback: "/formules" });
  const repo = getRepo();
  const me = v.profile.id;
  const [code, referrals, rewards, grants] = await Promise.all([repo.getReferralCode(me), repo.listReferrals({ referrerId: me }), repo.listRewards(), repo.listGrants({ beneficiaryId: me })]);
  const url = await referralLink(code);
  const members = referrals.filter((r) => r.status === "member").length;
  const waiting = grants.filter((g) => g.status === "granted").length;
  return (
    <Screen group="member" index={7} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Parrainage</div>
            <h1 className="scr-title">Fais entrer tes amies</h1>
            <p className="scr-sub">Partage ton lien ou ton code. Quand une amie devient membre, tu reçois ta récompense.</p>
          </div>
        </div>
        <section className="card ref-hero">
          <div>
            <div className="eyebrow">Mon code personnel</div>
            <div className="ref-code">{code}</div>
            <ShareLink url={url} code={code} />
          </div>
          <div className="stat-row">
            <div className="stat">
              <b>{referrals.length}</b>
              <span>{plural(referrals.length, "inscrite", "inscrites")}</span>
            </div>
            <div className="stat">
              <b>{members}</b>
              <span>{plural(members, "devenue membre", "devenues membres")}</span>
            </div>
            <div className="stat">
              <b>{grants.length}</b>
              <span>{plural(grants.length, "récompense", "récompenses")}</span>
            </div>
          </div>
        </section>

        <div className="eg-two" style={{ marginTop: 24 }}>
          <section className="card">
            <h2 className="h-sm" style={{ marginBottom: 6 }}>
              Mes filleules
            </h2>
            {referrals.length === 0 && <div className="empty">Personne encore : partage ton lien à une amie qui arrive à Marrakech.</div>}
            {referrals.map((r) => (
              <div key={r.id} className="eg-row">
                <Avatar name={r.referredName} />
                <span>
                  <b>{r.referredName}</b>
                  <span className="sub">
                    Inscrite le {dayMonthLong(r.createdAt)}
                    {r.convertedAt ? ` · membre depuis le ${dayMonthLong(r.convertedAt)}` : ""}
                  </span>
                </span>
                <span className="end">
                  <span className={"st" + (r.status === "member" ? " ok" : r.status === "cancelled" ? " no" : "")}>
                    {r.status === "member" ? "Membre" : r.status === "cancelled" ? "Annulé" : "Compte gratuit"}
                  </span>
                </span>
              </div>
            ))}
          </section>
          <div className="eg-stack">
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Ce que tu gagnes
              </h2>
              {rewards.length === 0 && <p className="w-empty">Les fondatrices préparent les récompenses.</p>}
              {rewards.map((w) => (
                <div key={w.id} className="offer" style={{ cursor: "default" }}>
                  <span className="o-badge">{w.kind === "points" ? `+${w.points}` : <Icon name={w.kind === "free_month" ? "cal" : "gift"} />}</span>
                  <span>
                    <b>{w.label}</b>
                    <span>{w.description ?? "Pour chaque filleule devenue membre."}</span>
                  </span>
                </div>
              ))}
              <p className="notice">
                <Icon name="check" />
                Attribuée automatiquement dès que ta filleule adhère (inscription avec ton lien ou ton code).
              </p>
            </section>
            <section className="card">
              <div className="row-head" style={{ marginBottom: 6 }}>
                <h2 className="h-sm">Mes récompenses</h2>
                {waiting > 0 && <span className="chip gold">{waiting} à recevoir</span>}
              </div>
              {grants.length === 0 && <p className="w-empty">Elles apparaîtront ici.</p>}
              {grants.map((g) => (
                <div key={g.id} className="eg-row">
                  <span className="rank">{g.kind === "points" ? <Icon name="star" /> : <Icon name="gift" />}</span>
                  <span>
                    <b>{g.label}</b>
                    <span className="sub">{dayMonthLong(g.createdAt)}</span>
                  </span>
                  <span className="end">
                    <span className={"st" + (g.status === "delivered" ? " ok" : "")}>{g.status === "delivered" ? (g.kind === "points" ? "Créditée" : "Remise") : "En préparation"}</span>
                  </span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
