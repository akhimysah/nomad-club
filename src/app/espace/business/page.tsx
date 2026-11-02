import type { Metadata } from "next";
import { DealActions, DeclareDealButton, OptOutToggle } from "@/components/engagement/client";
import { EIcon } from "@/components/engagement/EIcon";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dayMonthLong, fullName, money, plural, ymdLong } from "@/lib/format";
import type { DealCategory, DealView } from "@/lib/modules/engagement/types";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Espace Business" };
export const dynamic = "force-dynamic";

const DEAL_CATEGORY: Record<DealCategory, string> = { prestation: "Prestation", vente: "Vente", partenariat: "Partenariat", recommandation: "Recommandation", autre: "Autre" };

/** Espace Business : déclarer un deal entre membres, le faire confirmer, gagner des points, classement. */
export default async function BusinessPage() {
  const v = await requireCapability("business.use", { next: "/espace/business", fallback: "/formules" });
  const repo = getRepo();
  const me = v.profile.id;
  const [deals, points, board, settings, prefs, directory] = await Promise.all([
    repo.listDeals({ profileId: me }),
    repo.listPoints(me),
    repo.leaderboard(50),
    repo.getEngagementSettings(),
    repo.getEngagementPrefs(me),
    repo.listDirectory(),
  ]);
  const total = points.reduce((s, p) => s + p.points, 0);
  const toConfirm = deals.filter((d) => d.status === "pending" && d.partnerId === me);
  const mineWaiting = deals.filter((d) => d.status === "pending" && d.declaredBy === me);
  const history = deals.filter((d) => d.status !== "pending");
  const confirmed = history.filter((d) => d.status === "confirmed");
  const myRank = board.findIndex((r) => r.profileId === me);
  const members = directory.filter((p) => p.id !== me).map((p) => ({ id: p.id, name: fullName(p), job: p.job }));
  const other = (d: DealView) => (d.declaredBy === me ? d.partnerName : d.declaredByName);

  return (
    <Screen group="member" index={8} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Espace Business</div>
            <h1 className="scr-title">Les affaires entre membres</h1>
            <p className="scr-sub">Tu as travaillé avec une autre membre ? Déclare le deal : une fois confirmé par elle, vous gagnez des points toutes les deux.</p>
          </div>
          <DeclareDealButton members={members} today={today()} />
        </div>
        <p className="no-fee">
          <Icon name="lock" />
          <span>
            <b>Le club ne prélève aucune commission</b> et n’est pas partie aux deals : ils se concluent librement entre membres. La déclaration sert seulement à mesurer les retombées du réseau et à
            remercier celles qui le font vivre.
          </span>
        </p>

        <div className="eg-two">
          <div className="eg-stack">
            <section className="card biz-hero">
              <div>
                <div className="eyebrow">Mes points</div>
                <div className="big-num" style={{ marginTop: 8 }}>
                  {total}
                  <small>{plural(total, "point", "points")}</small>
                </div>
                <p className="w-empty">
                  {confirmed.length} {plural(confirmed.length, "deal confirmé", "deals confirmés")}
                  {myRank >= 0 ? ` · ${myRank + 1}${myRank === 0 ? "re" : "e"} du classement` : ""}
                </p>
              </div>
              <span className="rank top" style={{ width: 64, height: 64 }}>
                <EIcon name="trophy" />
              </span>
            </section>

            {toConfirm.length > 0 && (
              <section className="card">
                <div className="row-head" style={{ marginBottom: 6 }}>
                  <h2 className="h-sm">À confirmer</h2>
                  <span className="chip gold">{toConfirm.length}</span>
                </div>
                {toConfirm.map((d) => (
                  <div key={d.id} className="eg-row">
                    <Avatar name={d.declaredByName} />
                    <span>
                      <b>{d.nature}</b>
                      <span className="sub">
                        Déclaré par {d.declaredByName} · {DEAL_CATEGORY[d.category]} · {ymdLong(d.dealDate)}
                        {d.amount ? ` · ${money(d.amount)}` : ""}
                      </span>
                      {d.note && <span className="sub">« {d.note} »</span>}
                    </span>
                    <span className="end">
                      <DealActions dealId={d.id} mode="respond" />
                    </span>
                  </div>
                ))}
              </section>
            )}

            {mineWaiting.length > 0 && (
              <section className="card">
                <h2 className="h-sm" style={{ marginBottom: 6 }}>
                  En attente de confirmation
                </h2>
                {mineWaiting.map((d) => (
                  <div key={d.id} className="eg-row">
                    <Avatar name={d.partnerName} />
                    <span>
                      <b>{d.nature}</b>
                      <span className="sub">
                        Avec {d.partnerName} · envoyé le {dayMonthLong(d.createdAt)}
                      </span>
                    </span>
                    <span className="end">
                      <DealActions dealId={d.id} mode="withdraw" />
                    </span>
                  </div>
                ))}
              </section>
            )}

            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Historique
              </h2>
              {history.length === 0 && <div className="empty">Ton premier deal confirmé apparaîtra ici.</div>}
              {history.map((d) => (
                <div key={d.id} className="eg-row">
                  <Avatar name={other(d)} />
                  <span>
                    <b>{d.nature}</b>
                    <span className="sub">
                      Avec {other(d)} · {ymdLong(d.dealDate)}
                      {d.amount ? ` · ${money(d.amount)}` : ""}
                    </span>
                  </span>
                  <span className="end">
                    {d.status === "confirmed" ? <span className="st ok">+{d.pointsEach} pts</span> : <span className="st no">Non confirmé</span>}
                  </span>
                </div>
              ))}
            </section>
          </div>

          <div className="eg-stack">
            <section className="card">
              <h2 className="h-sm w-title" style={{ marginBottom: 6 }}>
                <EIcon name="trophy" />
                Classement
              </h2>
              {board.length === 0 && <p className="w-empty">Le classement démarre avec les premiers deals confirmés.</p>}
              {board.slice(0, 10).map((r, i) => (
                <div key={r.profileId} className={"eg-row" + (r.profileId === me ? " me" : "")}>
                  <span className={"rank" + (i < 3 ? " top" : "")}>{i + 1}</span>
                  <span>
                    <b>{r.profileId === me ? `${r.name} (toi)` : r.name}</b>
                    <span className="sub">
                      {r.deals} {plural(r.deals, "deal", "deals")}
                    </span>
                  </span>
                  <span className="end">
                    <b>{r.points} pts</b>
                  </span>
                </div>
              ))}
              {myRank >= 10 && (
                <div className="eg-row me">
                  <span className="rank">{myRank + 1}</span>
                  <span>
                    <b>{fullName(v.profile)} (toi)</b>
                  </span>
                  <span className="end">
                    <b>{total} pts</b>
                  </span>
                </div>
              )}
              <OptOutToggle optOut={prefs?.leaderboardOptOut ?? false} />
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Le barème
              </h2>
              <div className="kv">
                <span>Par deal confirmé</span>
                <b>{settings.dealPointsBase} points chacune</b>
              </div>
              <div className="kv">
                <span>Bonus par tranche de 1 000 $</span>
                <b>+{settings.dealPointsPerThousand} points</b>
              </div>
              <div className="kv">
                <span>Bonus maximum</span>
                <b>{settings.dealPointsBonusCap} points</b>
              </div>
              <p className="notice">
                <Icon name="star" />
                Les points récompensent aussi le parrainage. Ils n’ont pas de valeur monétaire.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
