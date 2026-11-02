import type { Metadata } from "next";
import Link from "next/link";
import { FileLink, ProductCover, ShopTabs } from "@/components/engagement/shop";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthLong, money } from "@/lib/format";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Mes ressources" };
export const dynamic = "force-dynamic";

/** Mes ressources : tout ce que j'ai acheté, téléchargeable à tout moment. */
export default async function MyResourcesPage() {
  const v = await requireCapability("shop.buy", { next: "/espace/boutique/mes-ressources", fallback: "/formules" });
  const repo = getRepo();
  const purchases = (await repo.listPurchases({ profileId: v.profile.id })).filter((p) => p.status === "paid");
  const products = await Promise.all(purchases.map((p) => repo.getProduct({ id: p.productId })));
  return (
    <Screen group="member" index={6} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Ressources digitales</div>
            <h1 className="scr-title">Mes ressources</h1>
          </div>
        </div>
        <ShopTabs current="mine" />
        {purchases.length === 0 && (
          <div className="card lock-card">
            <Icon name="book" />
            <h2 className="sh-title">Rien pour l’instant</h2>
            <p className="sh-sub">Les guides que tu achètes apparaissent ici, prêts à télécharger.</p>
            <Link className="btn btn-gold" href="/espace/boutique">
              Voir la boutique <Icon name="arrow-r" />
            </Link>
          </div>
        )}
        <div className="eg-stack">
          {purchases.map((pu, i) => {
            const p = products[i];
            if (!p) return null;
            return (
              <section key={pu.id} className="card res-row">
                <Link href={`/espace/boutique/${p.slug}`} aria-label={p.title}>
                  <ProductCover p={p} />
                </Link>
                <div>
                  <h2 className="h-sm" style={{ fontSize: 20 }}>
                    {p.title}
                  </h2>
                  <p className="muted" style={{ margin: "4px 0 6px", fontSize: 14 }}>
                    {pu.amount > 0 ? `Achetée le ${dayMonthLong(pu.createdAt)} · ${money(pu.amount)}` : `Offerte le ${dayMonthLong(pu.createdAt)}`}
                    {pu.paymentRef ? ` · réf. ${pu.paymentRef}` : ""}
                  </p>
                  {p.files.map((f) => (
                    <FileLink key={f.id} f={f} href={`/espace/boutique/telecharger/${f.id}`} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}
