import type { Metadata } from "next";
import { ShopCard, ShopTabs } from "@/components/engagement/shop";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { inCircle } from "@/lib/permissions";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Boutique" };
export const dynamic = "force-dynamic";

/** Boutique des ressources digitales (guides, modèles, supports d'ateliers). */
export default async function ShopPage() {
  const v = await requireCapability("shop.buy", { next: "/espace/boutique", fallback: "/formules" });
  const repo = getRepo();
  const [products, purchases] = await Promise.all([repo.listProducts(), repo.listPurchases({ profileId: v.profile.id })]);
  const owned = new Set(purchases.filter((p) => p.status === "paid").map((p) => p.productId));
  return (
    <Screen group="member" index={6} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Ressources digitales</div>
            <h1 className="scr-title">La boutique du club</h1>
            <p className="scr-sub">Guides, modèles et supports d’ateliers écrits par et pour les membres. Prix membre, accès immédiat.</p>
          </div>
        </div>
        <ShopTabs current="shop" />
        {products.length === 0 && <div className="empty">La boutique ouvre bientôt.</div>}
        <div className="shop-grid">
          {products.map((p) => (
            <ShopCard key={p.id} p={p} owned={owned.has(p.id)} member={inCircle(v.profile)} />
          ))}
        </div>
      </div>
    </Screen>
  );
}
