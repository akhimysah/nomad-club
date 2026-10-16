/**
 * Assistant du club : réponses par règles, construites à partir du carnet, de l'agenda et de l'annuaire.
 * Fonction pure (pas d'accès aux données) : testable et identique en démo et en mode réel.
 */
import { dayLong, dayMonthLong, fullName, hour, normalize, ymdLong } from "../format";
import type { BookingView, EventView, PartnerOffer, Place, Plan, Profile } from "../types";
import { priceFor } from "./events";

export type AiAction = { label: string; href?: string; ticket?: boolean };
export type AiAnswer = { text: string; actions: AiAction[] };

export type AiContext = {
  plan: Plan;
  places: Place[];
  events: EventView[];
  nextBooking: BookingView | null;
  directory: Profile[];
  offers: PartnerOffer[];
};

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const noDot = (s: string) => s.replace(/[.\s]+$/, "");

function eventState(ev: EventView, plan: Plan): string {
  if (ev.stats.left <= 0) return "complet, mais la liste d’attente est ouverte";
  const left = `il reste ${ev.stats.left} place${ev.stats.left > 1 ? "s" : ""}`;
  if (ev.premiumFree) return plan === "premium" ? `offert pour toi, ${left}` : "réservé aux Premium";
  return `à ${priceFor(ev, plan)} $ pour toi, ${left}`;
}

export function answerQuestion(question: string, ctx: AiContext): AiAnswer {
  const s = normalize(question);
  const { places, events, plan } = ctx;
  const byCat = (c: Place["categories"][number]) => places.filter((p) => p.categories.includes(c));
  const evHref = (e: EventView) => `/espace/agenda/${e.slug}`;

  if (/brunch|petit[- ]?dej|patiss|gueliz|cafe/.test(s)) {
    const picks = places
      .filter((p) => normalize(p.area).includes("gueliz") && /brunch|patiss|petit/.test(normalize(p.kind)))
      .sort((a, b) => Number(/brunch/i.test(b.kind)) - Number(/brunch/i.test(a.kind)))
      .slice(0, 2);
    if (picks.length) {
      const [a, b] = picks;
      let text = `${picks.length > 1 ? "Deux adresses" : "Une adresse"} du carnet à Guéliz : ${a.name}, ${lc(noDot(a.note))}`;
      if (a.clubEventLabel && a.clubEventDate) text += ` (le club y était : ${a.clubEventLabel}, ${ymdLong(a.clubEventDate)})`;
      text += ".";
      if (b) text += ` Et ${b.name} : ${lc(noDot(b.note))}.`;
      const offer = ctx.offers.find((o) => picks.some((p) => p.name === o.partner));
      if (offer && plan !== "free") text += ` Avec ta carte chez ${offer.partner} : ${lc(noDot(offer.detail))}.`;
      return { text, actions: [{ label: "Voir le carnet", href: "/espace/carnet?filtre=manger" }] };
    }
  }

  if (/visa|sejour|titre|prefecture|residence/.test(s)) {
    const lawyer = ctx.directory.find((p) => /avocate d.affaires/i.test(p.job ?? "")) ?? ctx.directory.find((p) => /avocate/i.test(p.job ?? ""));
    let text =
      "Au-delà de 90 jours, il faut demander une carte de séjour auprès du service des étrangers dont dépend ton domicile. Prépare passeport, justificatif de domicile, photos d’identité et justificatif de ressources.";
    if (lawyer) text += ` ${fullName(lawyer)}, ${lc(lawyer.job ?? "")}, aide souvent les membres à s’y retrouver.`;
    return { text, actions: lawyer ? [{ label: `Écrire à ${lawyer.firstName}`, href: `/espace/cercle/${lawyer.id}` }] : [{ label: "Poser au salon", href: "/espace/cercle" }] };
  }

  if (/banque|compte|bancaire|argent|virement/.test(s))
    return {
      text: "Beaucoup de membres ont ouvert un compte en dirhams convertibles, pratique quand on est payée depuis l’étranger. Prends rendez-vous en agence avec passeport et justificatif de domicile. Pose la question au salon : les retours d’expérience y sont précieux.",
      actions: [{ label: "Ouvrir le salon", href: "/espace/cercle" }],
    };

  if (/ecole|enfant|scolar|creche|famille|kids/.test(s)) {
    const fam = byCat("famille").find((p) => /famille/i.test(p.kind)) ?? byCat("famille")[0];
    let text = "Pour l’école, le salon a déjà échangé sur les écoles françaises et bilingues de Guéliz et de l’Hivernage : demande les retours des mamans du club.";
    if (fam) text += ` Pour le week-end, ${fam.name}, ${lc(fam.area)} : ${lc(noDot(fam.note))}.`;
    return { text, actions: [{ label: "En famille dans le carnet", href: "/espace/carnet?filtre=famille" }, { label: "Ouvrir le salon", href: "/espace/cercle" }] };
  }

  if (/padel|sport|tennis|yoga|bien[- ]?etre|body/.test(s)) {
    const club = places.find((p) => /padel/i.test(p.name));
    const padel = events.find((e) => /padel/i.test(e.title));
    const wellness = events.find((e) => e.premiumFree);
    const parts: string[] = [];
    if (club) parts.push(`${club.name}, à ${club.area} : ${lc(noDot(club.note))}.`);
    if (padel) parts.push(`Le prochain tournoi, ${lc(dayLong(padel.startsAt))}, est ${eventState(padel, plan)}.`);
    if (wellness) parts.push(`Côté bien-être, ${wellness.title} le ${dayMonthLong(wellness.startsAt)}, ${plan === "premium" ? "offert pour toi" : "réservé aux Premium"}.`);
    const actions: AiAction[] = [];
    if (padel) actions.push({ label: "Voir le tournoi", href: evHref(padel) });
    actions.push({ label: "Bien-être et sport", href: "/espace/carnet?filtre=bien-etre-sport" });
    return { text: parts.join(" ") || "Regarde la rubrique Bien-être et sport du carnet.", actions };
  }

  if (/diner|soir|restaurant|manger/.test(s)) {
    const d = events.find((e) => /diner|dîner/i.test(normalize(e.title)) && e.stats.left > 0) ?? events.find((e) => /diner/.test(normalize(e.title)));
    if (d) {
      const place = places.find((p) => p.id === d.placeId);
      const where = `${d.venue ?? "lieu à confirmer"}${d.address ? `, ${lc(d.address)}` : ""}`;
      const price = priceFor(d, plan);
      const left = d.stats.left;
      let text = `Le prochain ${lc(d.title)} a lieu ${lc(dayLong(d.startsAt))} à ${where}`;
      text += place ? ` : ${lc(noDot(place.note))}.` : ".";
      text += left > 0 ? ` ${price ? `${price} $` : "Offert"} pour toi, il reste ${left} place${left > 1 ? "s" : ""}.` : " C’est complet, la liste d’attente est ouverte.";
      return { text, actions: [{ label: "Voir le dîner", href: evHref(d) }] };
    }
  }

  if (/lunch|prochain|agenda|quand|evenement|rendez/.test(s)) {
    const nb = ctx.nextBooking;
    if (nb) {
      let text = `Ton prochain rendez-vous : le ${nb.event.title}, ${lc(dayLong(nb.event.startsAt))} à ${hour(nb.event.startsAt)} au ${nb.event.venue ?? "lieu à confirmer"}. Ta place est réservée.`;
      const before = events.find((e) => e.startsAt < nb.event.startsAt && e.id !== nb.eventId);
      if (before) text += ` Avant, il y a ${before.title} le ${dayMonthLong(before.startsAt)}${before.premiumFree ? ", réservé aux Premium" : ""}.`;
      return { text, actions: [{ label: "Mon billet", ticket: true }, { label: "Tout l’agenda", href: "/espace/agenda" }] };
    }
    const next = events[0];
    if (next)
      return {
        text: `Le prochain rendez-vous : ${next.title}, ${lc(dayLong(next.startsAt))} à ${hour(next.startsAt)}, ${next.venue ?? "lieu à confirmer"}. Il est ${eventState(next, plan)}.`,
        actions: [{ label: "Voir le rendez-vous", href: evHref(next) }, { label: "Tout l’agenda", href: "/espace/agenda" }],
      };
  }

  if (/rooftop|coucher|sortir|apero|terrasse/.test(s)) {
    const out = byCat("sortir");
    const roof = out.find((p) => /rooftop/i.test(p.kind)) ?? out[0];
    const calm = out.find((p) => p !== roof && /ralentir|calme/i.test(p.note)) ?? out.find((p) => p !== roof);
    if (roof) {
      let text = `${roof.name}, à ${roof.area} : ${lc(noDot(roof.note))}.`;
      if (calm) text += ` Pour un cadre plus calme, ${calm.name} ${calm.area === "Palmeraie" ? "dans la Palmeraie" : `à ${calm.area}`}.`;
      return { text, actions: [{ label: "Sortir dans le carnet", href: "/espace/carnet?filtre=sortir" }] };
    }
  }

  return {
    text: "Je n’ai pas encore de réponse précise à ça. Je transmets ta question à Julia et Nora, elles te répondent sous 24 h.",
    actions: [{ label: "Poser au salon", href: "/espace/cercle" }],
  };
}
