/**
 * « Stories » de l'accueil membre : petites bulles façon Instagram, construites côté serveur
 * à partir des données existantes (rendez-vous à venir, actualités, nouvelles membres, offre partenaire).
 * Une catégorie sans donnée est simplement omise ; sans rien du tout, la rangée disparaît.
 */
import type { Mine } from "@/components/events/EventBits";
import { daysBetween, today, ymdOf } from "../../clock";
import { getRepo } from "../../data";
import { dayLong, dayMonthShort, hour, placesText, timeRange } from "../../format";
import { isAdmin } from "../../permissions";
import type { EventView, Plan, Profile } from "../../types";
import type { DashboardNews } from "./news-source";

export type StoryPerson = { id: string; name: string; job: string | null; photo: string | null; href: string };

export type StorySlide = {
  /** Identifiant stable : sert à retenir ce qui a déjà été vu (localStorage). */
  id: string;
  kind: "event" | "news" | "members" | "offer";
  /** URL de l'image plein cadre (null : fond dégradé + monogramme). */
  image: string | null;
  imagePosition: string | null;
  eyebrow: string;
  title: string;
  text: string | null;
  /** Lignes d'infos (date, lieu…) avec leur icône. */
  meta: { icon: "cal" | "clock" | "pin" | "users" | "gift" | "bell"; text: string }[];
  chip: { text: string; tone: "booked" | "hot" | "plain" } | null;
  people: StoryPerson[];
  cta: { label: string; href: string } | null;
};

export type StoryGroup = {
  id: string;
  kind: StorySlide["kind"];
  label: string;
  /** Visuel de la bulle : photo, sinon initiales / icône. */
  cover: { image: string | null; position: string | null; initials: string | null; icon: "bell" | "users" | "gift" | null };
  /** Petite pastille sur la bulle (« 12 nov. », « Réservé »). */
  badge: string | null;
  slides: StorySlide[];
};

const eventImg = (f: string | null) => (f ? `/img/${f.replace(/^\/img\//, "")}` : null);

function eventGroup(e: EventView, mine: Mine | null, plan: Plan): StoryGroup {
  const booked = mine === "booked";
  const left = e.stats.left;
  const days = daysBetween(today(), ymdOf(e.startsAt));
  const when = days === 0 ? "Aujourd’hui" : days === 1 ? "Demain" : days > 1 && days < 7 ? `Dans ${days} jours` : dayLong(e.startsAt);
  const premiumOnly = e.premiumFree && plan !== "premium";
  const chip: StorySlide["chip"] = booked
    ? { text: "Ta place est réservée", tone: "booked" }
    : mine === "waitlist"
      ? { text: "Sur la liste d’attente", tone: "plain" }
      : premiumOnly
        ? { text: "Réservé aux Premium", tone: "plain" }
        : left <= 0
          ? { text: "Complet", tone: "plain" }
          : left <= 3
            ? { text: left === 1 ? "Plus qu’une place" : `Plus que ${left} places`, tone: "hot" }
            : { text: placesText(left), tone: "plain" };
  const label = booked ? "Voir mon rendez-vous" : left > 0 && !premiumOnly && mine !== "waitlist" ? "Réserver ma place" : "Voir le rendez-vous";
  return {
    id: `g-${e.id}`,
    kind: "event",
    label: e.shortTitle ?? e.title,
    cover: { image: eventImg(e.image), position: e.imagePosition, initials: null, icon: null },
    badge: booked ? "Réservé" : days === 0 ? "Ce soir" : dayMonthShort(e.startsAt),
    slides: [
      {
        id: `s-${e.id}`,
        kind: "event",
        image: eventImg(e.image),
        imagePosition: e.imagePosition,
        eyebrow: when,
        title: e.title,
        text: null,
        meta: [
          { icon: "cal", text: `${dayLong(e.startsAt)} · ${timeRange(e.startsAt, e.endsAt) || hour(e.startsAt)}` },
          { icon: "pin", text: e.venue ?? "Lieu à confirmer" },
        ],
        chip,
        people: [],
        cta: { label, href: `/espace/agenda/${e.slug}` },
      },
    ],
  };
}

function newsGroup(news: DashboardNews[]): StoryGroup | null {
  if (news.length === 0) return null;
  const first = news.find((n) => n.image) ?? null;
  return {
    id: "news",
    kind: "news",
    label: "Actus",
    cover: { image: first ? eventImg(first.image) : null, position: null, initials: null, icon: "bell" },
    badge: null,
    slides: news.map((n) => ({
      id: `news-${n.id}`,
      kind: "news",
      image: eventImg(n.image),
      imagePosition: null,
      eyebrow: `${n.pinned ? "Épinglé · " : ""}${dayMonthShort(n.publishedAt)} · ${n.author}`,
      title: n.title,
      text: n.excerpt,
      meta: [],
      chip: null,
      people: [],
      cta: { label: "Lire l’actualité", href: n.link ?? "/espace/actualites" },
    })),
  };
}

/** Membres arrivées récemment, d'après l'annuaire filtré (confidentialité appliquée : fiches masquées exclues, fiches « basic » sans photo). */
async function membersGroup(me: Profile): Promise<StoryGroup | null> {
  try {
    const repo = getRepo();
    const [entries, dir] = await Promise.all([repo.listDirectoryEntries(me, { admin: isAdmin(me) }), repo.listDirectory()]);
    // La date d'arrivée ne sert qu'au tri ; seuls les champs de la fiche d'annuaire sont affichés.
    const joined = new Map(dir.map((p) => [p.id, p.createdAt]));
    const t = today();
    const recent = entries
      .filter((e) => e.badge !== "Fondatrice" && e.id !== me.id)
      .map((e) => ({ e, at: joined.get(e.id) ?? null }))
      .filter((x): x is { e: (typeof entries)[number]; at: string } => !!x.at && daysBetween(ymdOf(x.at), t) <= 365)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 4)
      .map((x) => x.e);
    if (recent.length === 0) return null;
    const people: StoryPerson[] = recent.map((e) => ({ id: e.id, name: e.firstName, job: e.job, photo: e.limited ? null : e.photo, href: `/espace/cercle/${e.id}` }));
    const names = people.map((p) => p.name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
    return {
      id: "members",
      kind: "members",
      label: "Bienvenue",
      cover: { image: people[0].photo, position: null, initials: people[0].name, icon: "users" },
      badge: null,
      slides: [
        {
          id: `members-${people.map((p) => p.id).join("-")}`,
          kind: "members",
          image: null,
          imagePosition: null,
          eyebrow: "Nouvelles membres",
          title: `Dis bonjour à ${list}`,
          text: people.length === 1 ? "Elle vient de rejoindre le club. Un petit mot pour l’accueillir ?" : "Elles viennent de rejoindre le club. Un petit mot pour les accueillir ?",
          meta: [],
          chip: null,
          people,
          cta: { label: "Voir l’annuaire", href: "/espace/cercle?onglet=annuaire" },
        },
      ],
    };
  } catch {
    return null;
  }
}

async function offerGroup(): Promise<StoryGroup | null> {
  try {
    const o = (await getRepo().listPartnerOffers())[0];
    if (!o) return null;
    return {
      id: "offer",
      kind: "offer",
      label: "Offre",
      cover: { image: null, position: null, initials: null, icon: "gift" },
      badge: o.badge.length <= 8 ? o.badge : null,
      slides: [
        {
          id: `offer-${o.id}`,
          kind: "offer",
          image: null,
          imagePosition: null,
          eyebrow: "Offre partenaire du moment",
          title: o.partner,
          text: o.detail,
          meta: [{ icon: "gift", text: o.badge }],
          chip: null,
          people: [],
          cta: { label: "Voir les offres", href: "/espace/offres" },
        },
      ],
    };
  } catch {
    return null;
  }
}

/** Assemble les stories de l'accueil (rendez-vous et actualités déjà chargés par la page). */
export async function buildStories(input: { me: Profile; events: EventView[]; mine: Map<string, Mine>; news: DashboardNews[] }): Promise<StoryGroup[]> {
  const { me, events, mine, news } = input;
  const [members, offer] = await Promise.all([membersGroup(me), offerGroup()]);
  const evs = [...new Map(events.map((e) => [e.id, e])).values()].slice(0, 5).map((e) => eventGroup(e, mine.get(e.id) ?? null, me.plan));
  return [...evs, newsGroup(news), members, offer].filter((g): g is StoryGroup => !!g);
}
