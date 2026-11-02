import Link from "next/link";
import { getRepo } from "@/lib/data";
import { dayMonthLong } from "@/lib/format";
import { Icon } from "../ui/Icon";

/** Lot 1 — Bloc « Actualités » de l'accueil membre : l'épinglée et les deux dernières. */
export async function NewsHomeBlock({ viewerId }: { viewerId: string }) {
  const posts = (await getRepo().listNews({ viewerId, limit: 3 })).slice(0, 3);
  if (!posts.length) return null;
  return (
    <section className="card">
      <div className="row-head">
        <h2 className="h-sm">Actualités du club</h2>
        <Link className="link" href="/espace/actualites">
          Tout lire <Icon name="arrow-r" />
        </Link>
      </div>
      <div className="cm-home">
        {posts.map((p) => (
          <Link key={p.id} href={`/espace/actualites#post-${p.id}`} className="cm-home-item">
            <span className="ph">{p.image ? <img src={p.image} alt="" /> : <Icon name={p.pinned ? "star" : "bell"} />}</span>
            <span>
              <b>{p.title}</b>
              <span>
                {p.pinned ? "Épinglé · " : ""}
                {p.publishedAt ? dayMonthLong(p.publishedAt) : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
