/** Éléments de la boutique (composants serveur). */
import Link from "next/link";
import { money } from "@/lib/format";
import type { Product, ProductFile } from "@/lib/modules/engagement/types";
import { EIcon } from "./EIcon";

export const CATEGORY_LABEL: Record<Product["category"], string> = { guide: "Guide", modele: "Modèles", formation: "Atelier", carnet: "Carnet" };

export function sizeLabel(n: number | null): string {
  if (!n) return "PDF";
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`;
}

/** Couverture : photo du club en noir et blanc, ou couverture typographique. */
export function ProductCover({ p, badge }: { p: Pick<Product, "title" | "subtitle" | "category" | "coverImage">; badge?: React.ReactNode }) {
  return (
    <span className={"cover" + (p.coverImage ? "" : " typo")}>
      {p.coverImage ? <img src={p.coverImage} alt="" loading="lazy" /> : <img className="mono" src="/img/monogramme-clair.png" alt="" />}
      <span className="veil" />
      {badge}
      <span className="cover-txt">
        <span className="eyebrow">{CATEGORY_LABEL[p.category]} · Nomad Club</span>
        <b>{p.title}</b>
      </span>
    </span>
  );
}

export function PriceTag({ p, member }: { p: Pick<Product, "price" | "priceMember">; member: boolean }) {
  const mine = member ? p.priceMember : p.price;
  return (
    <span className="shop-price">
      <strong>{mine === 0 ? "Offert" : money(mine)}</strong>
      {member && p.priceMember < p.price && <s>{money(p.price)}</s>}
      {member && p.priceMember < p.price && <span className="chip gold">Prix membre</span>}
    </span>
  );
}

export function ShopCard({ p, owned, member }: { p: Product; owned: boolean; member: boolean }) {
  return (
    <Link className="shop-card" href={`/espace/boutique/${p.slug}`}>
      <ProductCover
        p={p}
        badge={
          owned ? (
            <span className="chip solid">
              <svg className="ic" aria-hidden="true">
                <use href="#i-check" />
              </svg>
              Dans mes ressources
            </span>
          ) : undefined
        }
      />
      <span className="shop-body">
        <b>{p.title}</b>
        {p.subtitle && <p>{p.subtitle}</p>}
        {owned ? (
          <span className="shop-price">
            <span className="link">
              Ouvrir <EIcon name="download" />
            </span>
          </span>
        ) : (
          <PriceTag p={p} member={member} />
        )}
      </span>
    </Link>
  );
}

export function FileLink({ f, href, locked }: { f: ProductFile; href: string | null; locked?: boolean }) {
  const inner = (
    <>
      <EIcon name={locked ? "file" : "download"} />
      <span>
        <b>{f.label}</b>
        <span>
          {f.fileName} · {sizeLabel(f.sizeBytes)}
          {f.isPreview ? " · aperçu gratuit" : ""}
        </span>
      </span>
      <span className="end">{locked ? <span className="st no">Après achat</span> : <span className="st">Télécharger</span>}</span>
    </>
  );
  return href && !locked ? (
    <a className="file-row" href={href} download={f.fileName}>
      {inner}
    </a>
  ) : (
    <div className="file-row locked">{inner}</div>
  );
}

export function ShopTabs({ current }: { current: "shop" | "mine" }) {
  return (
    <nav className="eg-tabs" aria-label="Boutique">
      <Link className={"seg-chip" + (current === "shop" ? " on" : "")} href="/espace/boutique" aria-current={current === "shop" ? "page" : undefined}>
        Boutique
      </Link>
      <Link className={"seg-chip" + (current === "mine" ? " on" : "")} href="/espace/boutique/mes-ressources" aria-current={current === "mine" ? "page" : undefined}>
        Mes ressources
      </Link>
    </nav>
  );
}
