import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddFileForm, ProductForm, ProductStatusButtons, RemoveFileButton } from "@/components/engagement/admin";
import { EIcon } from "@/components/engagement/EIcon";
import { sizeLabel } from "@/components/engagement/shop";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthShort, money } from "@/lib/format";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Ressource" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> };

/** Fiche d'une ressource (fondatrices) : contenu, fichiers, publication, acheteuses. */
export default async function AdminProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ok } = await searchParams;
  const v = await requireCapability("shop.manage", { next: `/fondatrices/boutique/${id}` });
  const repo = getRepo();
  const p = await repo.getProduct({ id });
  if (!p) notFound();
  const buyers = (await repo.listPurchases()).filter((x) => x.productId === p.id);
  const status = { draft: "Brouillon", published: "En ligne", archived: "Retirée" }[p.status];
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner">
        <Link className="link" href="/fondatrices/boutique">
          <Icon name="chev-l" />
          Boutique
        </Link>
        <FHead title={p.title} sub={`${status} · ${p.sales} vente(s)`} />
        {ok && (
          <div className="flash" role="status">
            <Icon name="check" />
            Ressource enregistrée.
          </div>
        )}
        <div className="f-grid">
          <ProductForm product={p} />
          <div className="eg-stack">
            <section className="card">
              <div className="row-head">
                <h2 className="h-sm">Publication</h2>
                {p.status === "published" && (
                  <Link className="link" href={`/espace/boutique/${p.slug}`}>
                    Voir la fiche <Icon name="arrow-r" />
                  </Link>
                )}
              </div>
              <ProductStatusButtons id={p.id} status={p.status} />
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 4 }}>
                Fichiers
              </h2>
              {p.files.length === 0 && <p className="w-empty">Aucun fichier : ajoutez-en au moins un avant de publier.</p>}
              {p.files.map((f) => (
                <div key={f.id} className="file-row">
                  <EIcon name="file" />
                  <span>
                    <b>{f.label}</b>
                    <span>
                      {f.fileName} · {sizeLabel(f.sizeBytes)}
                      {f.isPreview ? " · aperçu gratuit" : ""}
                      {!f.storagePath ? " · exemple généré" : ""}
                    </span>
                  </span>
                  <span className="end">
                    <a className="btn btn-ghost btn-xs" href={`/fondatrices/boutique/fichier/${f.id}`}>
                      <EIcon name="download" />
                    </a>
                    <RemoveFileButton fileId={f.id} />
                  </span>
                </div>
              ))}
              <AddFileForm productId={p.id} demo={v.mode === "demo"} />
              <p className="notice">
                <Icon name="lock" />
                Fichiers stockés dans un espace privé : téléchargement uniquement par les acheteuses, par lien signé valable une minute.
              </p>
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Acheteuses
              </h2>
              {buyers.length === 0 && <p className="w-empty">Pas encore de vente.</p>}
              {buyers.map((b) => (
                <div key={b.id} className="eg-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span>
                    <b>{b.buyerName}</b>
                    <span className="sub">
                      {dayMonthShort(b.createdAt)}
                      {b.paymentRef ? ` · ${b.paymentRef}` : ""}
                    </span>
                  </span>
                  <span className="end">{b.amount ? money(b.amount) : "Offert"}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
