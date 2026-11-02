import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/engagement/client";
import { CATEGORY_LABEL, FileLink, PriceTag, ProductCover } from "@/components/engagement/shop";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthLong, plural } from "@/lib/format";
import { priceFor } from "@/lib/modules/engagement/billing";
import "@/styles/engagement.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getRepo().getProduct({ slug: (await params).slug });
  return { title: p?.title ?? "Boutique" };
}

/** Fiche d'une ressource : présentation, extrait, fichiers (aperçu gratuit, le reste après achat). */
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const v = await requireCapability("shop.buy", { next: `/espace/boutique/${slug}`, fallback: "/formules" });
  const repo = getRepo();
  const p = await repo.getProduct({ slug });
  if (!p || p.status !== "published") notFound();
  const purchases = await repo.listPurchases({ profileId: v.profile.id });
  const bought = purchases.find((x) => x.productId === p.id && x.status === "paid");
  const amount = priceFor(p, v.profile);
  const dl = (id: string) => `/espace/boutique/telecharger/${id}`;
  return (
    <Screen group="member" index={6} className="mscreen scroller on">
      <div className="m-inner">
        <Link className="link" href="/espace/boutique" style={{ marginBottom: 14 }}>
          <Icon name="chev-l" />
          La boutique
        </Link>
        <div className="pd-grid">
          <ProductCover p={p} />
          <div>
            <div className="eyebrow">
              {CATEGORY_LABEL[p.category]}
              {p.pages ? ` · ${p.pages} pages` : ""}
            </div>
            <h1 className="scr-title" style={{ display: "block" }}>
              {p.title}
            </h1>
            {p.subtitle && <p className="scr-sub">{p.subtitle}</p>}
            {bought ? (
              <div className="pd-buy">
                <span className="chip solid">
                  <Icon name="check" />
                  Achetée le {dayMonthLong(bought.createdAt)}
                </span>
              </div>
            ) : (
              <div className="pd-buy">
                <PriceTag p={p} member />
                <BuyButton productId={p.id} title={p.title} amount={amount} label={amount > 0 ? "Acheter" : "L’obtenir"} demo={v.mode === "demo"} />
              </div>
            )}
            <p className="pd-desc">{p.description}</p>
            {p.previewText && (
              <blockquote className="pd-preview">
                <span className="eyebrow" style={{ display: "block", fontStyle: "normal", marginBottom: 8 }}>
                  Extrait
                </span>
                {p.previewText}
              </blockquote>
            )}
            <section style={{ marginTop: 26 }}>
              <h2 className="h-sm">{bought ? "Tes fichiers" : plural(p.files.length, "Fichier inclus", "Fichiers inclus")}</h2>
              {p.files.length === 0 && <div className="empty">Les fichiers arrivent bientôt.</div>}
              {p.files.map((f) => (
                <FileLink key={f.id} f={f} href={dl(f.id)} locked={!bought && !f.isPreview} />
              ))}
              <p className="notice">
                <Icon name="lock" />
                Téléchargement réservé à ton compte, pour un usage personnel. Le fichier porte ton nom.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
