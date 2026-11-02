/** Citation du jour : une phrase par jour, la même pour toutes les membres (choisie d'après la date). */

export type Quote = { text: string; author: string };

export const QUOTES: readonly Quote[] = [
  { text: "On ne naît pas femme : on le devient.", author: "Simone de Beauvoir" },
  { text: "Dans la vie, rien n’est à craindre, tout est à comprendre.", author: "Marie Curie" },
  { text: "Le succès, c’est d’aller d’échec en échec sans perdre son enthousiasme.", author: "Proverbe d’entrepreneur" },
  { text: "Seule on va plus vite, ensemble on va plus loin.", author: "Proverbe africain" },
  { text: "Celle qui déplace la montagne commence par enlever les petites pierres.", author: "Proverbe" },
  { text: "La patience est la clé du soulagement.", author: "Proverbe marocain" },
  { text: "Goutte après goutte, la rivière se remplit.", author: "Proverbe marocain" },
  { text: "Un réseau, ce n’est pas une liste de contacts : ce sont des personnes qui pensent à toi.", author: "Julia, cofondatrice" },
  { text: "Ose demander. Le pire qui puisse arriver, c’est un non, et tu en es au même point.", author: "Nora, cofondatrice" },
  { text: "Le meilleur moment pour planter un arbre, c’était il y a vingt ans. Le deuxième meilleur moment, c’est maintenant.", author: "Proverbe" },
  { text: "Ce que tu cherches te cherche aussi.", author: "Rûmî" },
  { text: "Change de cap autant qu’il le faut, mais garde ta boussole.", author: "Proverbe de voyageuse" },
  { text: "Une femme qui sait ce qu’elle vaut ne se brade pas.", author: "Proverbe" },
  { text: "Le voyage de mille lieues commence par un pas.", author: "Lao-tseu" },
  { text: "La confiance vient en faisant, pas en attendant d’être prête.", author: "Le cercle du Nomad Club" },
  { text: "Qui demande son chemin ne s’égare pas.", author: "Proverbe arabe" },
  { text: "Il n’y a pas de petit début.", author: "Le cercle du Nomad Club" },
  { text: "Le talent gagne des matchs, l’équipe gagne des championnats.", author: "Proverbe sportif" },
  { text: "Fais de ta vie un rêve, et d’un rêve, une réalité.", author: "Antoine de Saint-Exupéry" },
  { text: "Donne sans compter : on finit toujours par recevoir.", author: "Proverbe" },
  { text: "Ce n’est pas le pays qu’on quitte qui compte, c’est le cercle qu’on construit.", author: "Le cercle du Nomad Club" },
];

/** Citation d'un jour (AAAA-MM-JJ). */
export function quoteOfDay(ymd: string): Quote {
  const n = Math.floor(Date.parse(ymd + "T00:00:00Z") / 86400000);
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
