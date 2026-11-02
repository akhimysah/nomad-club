import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsEditor } from "@/components/communaute/NewsAdmin";
import { FHead } from "@/components/founders/parts";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Publication" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Lot 1 — Écrire une publication (« nouvelle ») ou modifier une publication existante. */
export default async function NewsEditPage({ params }: Props) {
  const { id } = await params;
  await requireCapability("news.manage", { next: `/fondatrices/communaute/actualites/${id}` });
  const isNew = id === "nouvelle";
  const post = isNew ? null : await getRepo().getNews(id, null);
  if (!isNew && !post) notFound();
  const initial = post
    ? { id: post.id, title: post.title, body: post.body, image: post.image, pinned: post.pinned, commentsEnabled: post.commentsEnabled, published: post.status === "published" }
    : { title: "", body: "", image: null, pinned: false, commentsEnabled: false, published: false };
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner" style={{ maxWidth: 820 }}>
        <FHead title={isNew ? "Nouvelle publication" : "Modifier la publication"} sub="Communauté · Actualités" />
        <NewsEditor initial={initial} />
      </div>
    </Screen>
  );
}
