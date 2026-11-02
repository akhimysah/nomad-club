/**
 * Source des actualités du widget « Actualités du club ».
 *
 * Branchée sur les actualités publiées du Lot 1 (communauté). Les exemples ci-dessous ne servent
 * qu'en démo, si aucune publication n'existe encore.
 */
import { isRealMode } from "../../env";
import { getRepo } from "../../data";

export type DashboardNews = {
  id: string;
  title: string;
  excerpt: string;
  /** Instant ISO de publication. */
  publishedAt: string;
  author: string;
  pinned: boolean;
  image: string | null;
  /** Lien interne vers l'actualité complète (null tant que le Lot 1 n'est pas fusionné). */
  link: string | null;
  /** Exemple affiché faute de module communauté. */
  sample: boolean;
};

const iso = (ymd: string, time: string) => new Date(`${ymd}T${time}:00+01:00`).toISOString();

const SAMPLES: DashboardNews[] = [
  {
    id: "news-sample-1",
    title: "Le programme de novembre est en ligne",
    excerpt: "Un lunch au Fer7, le club de lecture chez Salma et un dîner Premium : réserve vite, les places partent en quelques jours.",
    publishedAt: iso("2026-10-13", "18:00"),
    author: "Julia",
    pinned: true,
    image: "/img/lunch-fer7.jpg",
    link: null,
    sample: true,
  },
  {
    id: "news-sample-2",
    title: "Bienvenue aux huit nouvelles membres d’octobre",
    excerpt: "Architecte, coach, photographe culinaire… Présentez-vous au salon Général et pensez à remplir votre fiche dans l’annuaire.",
    publishedAt: iso("2026-10-11", "10:30"),
    author: "Nora",
    pinned: false,
    image: null,
    link: null,
    sample: true,
  },
  {
    id: "news-sample-3",
    title: "Nouveau guide : prendre la parole en public",
    excerpt: "Le support de l’atelier du brunch est disponible dans la boutique, à prix membre.",
    publishedAt: iso("2026-09-21", "09:00"),
    author: "Julia",
    pinned: false,
    image: null,
    link: "/espace/boutique/prendre-la-parole-en-public",
    sample: true,
  },
];

const excerpt = (body: string) => {
  const t = body.replace(/\s+/g, " ").trim();
  return t.length > 160 ? t.slice(0, 157).trimEnd() + "…" : t;
};

export async function listDashboardNews(limit = 3, viewerId: string | null = null): Promise<DashboardNews[]> {
  const posts = await getRepo().listNews({ viewerId, limit });
  if (posts.length > 0) {
    return posts.slice(0, limit).map((p) => ({
      id: p.id,
      title: p.title,
      excerpt: excerpt(p.body),
      publishedAt: p.publishedAt ?? p.createdAt,
      author: p.authorName,
      pinned: p.pinned,
      image: p.image,
      link: `/espace/actualites#post-${p.id}`,
      sample: false,
    }));
  }
  if (isRealMode()) return [];
  return SAMPLES.slice(0, limit);
}
