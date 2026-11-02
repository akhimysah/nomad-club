import type { Metadata } from "next";
import Link from "next/link";
import { SimulatedPaymentsToggle } from "@/components/engagement/admin";
import { Bars } from "@/components/engagement/Bars";
import { CATEGORY_LABEL } from "@/components/engagement/shop";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dayMonthShort, money } from "@/lib/format";
import { shopStats } from "@/lib/modules/engagement/stats";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Boutique" };
export const dynamic = "force-dynamic";

const STATUS = { draft: "Brouillon", published: "En ligne", archived: "Retirée" } as const;

/** Boutique (fondatrices) : produits, ventes, paiement simulé. */
export default async function AdminShopPage() {
  const v = await requireCapability("shop.manage", { next: "/fondatrices/boutique" });
  const repo = getRepo();
  const [products, purchases, settings] = await Promise.all([repo.listProducts({ status: "all" }), repo.listPurchases(), repo.getEngagementSettings()]);
  const st = shopStats(purchases, today());
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Ressources digitales</div>
            <h1 className="scr-title">Boutique</h1>
          </div>
          <Link className="btn btn-ink" href="/fondatrices/boutique/nouveau">
            <Icon name="plus" />
            Nouvelle ressource
          </Link>
        </div>
        <div className="kpis">
          <div className="card kpi">
            <span className="lbl">
              <Icon name="wallet" />
              Chiffre d’affaires
            </span>
            <div className="val">{money(st.revenue)}</div>
            <div className="sub">{st.sales} ventes</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="users" />
              Acheteuses
            </span>
            <div className="val">{st.buyers}</div>
            <div className="sub">membres différentes</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="book" />
              En ligne
            </span>
            <div className="val">{products.filter((p) => p.status === "published").length}</div>
            <div className="sub">{products.filter((p) => p.status === "draft").length} brouillon(s)</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="lock" />
              Paiement
            </span>
            <div className="val" style={{ fontSize: 30 }}>
              {v.mode === "demo" || settings.simulatedPayments ? "Simulé" : "Coupé"}
            </div>
            <div className="sub">vrai paiement au Lot 2</div>
          </div>
        </div>
        <div className="f-grid">
          <section className="card">
            <h2 className="h-sm" style={{ marginBottom: 6 }}>
              Ressources
            </h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ressource</th>
                    <th>Statut</th>
                    <th className="num">Prix membre</th>
                    <th className="num">Ventes</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/fondatrices/boutique/${p.id}`} style={{ fontWeight: 600 }}>
                          {p.title}
                        </Link>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {CATEGORY_LABEL[p.category]} · {p.files.length} fichier(s)
                        </div>
                      </td>
                      <td>
                        <span className={"st" + (p.status === "published" ? " ok" : p.status === "archived" ? " no" : "")}>{STATUS[p.status]}</span>
                      </td>
                      <td className="num">{p.priceMember === 0 ? "Offert" : money(p.priceMember)}</td>
                      <td className="num">{p.sales}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="eg-stack">
            <section className="card">
              <h2 className="h-sm">Ventes sur 6 mois</h2>
              <Bars data={st.months} format={(n) => `${n} $`} />
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 10 }}>
                Paiement
              </h2>
              <SimulatedPaymentsToggle enabled={settings.simulatedPayments} demo={v.mode === "demo"} />
              <p className="notice">
                <Icon name="lock" />
                Aucune somme n’est débitée tant que le vrai paiement (Lot 2) n’est pas branché. En production, laissez coupé pour ne pas offrir les guides par erreur.
              </p>
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Dernières ventes
              </h2>
              {purchases.slice(0, 8).map((p) => (
                <div key={p.id} className="eg-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span>
                    <b>{p.buyerName}</b>
                    <span className="sub">
                      {p.product.title} · {dayMonthShort(p.createdAt)}
                    </span>
                  </span>
                  <span className="end">{p.amount ? money(p.amount) : "Offert"}</span>
                </div>
              ))}
              {!purchases.length && <p className="w-empty">Aucune vente pour l’instant.</p>}
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
