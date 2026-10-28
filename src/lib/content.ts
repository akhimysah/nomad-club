/** Textes fixes du site (repris de la maquette validée). */

export const PRICES = {
  member: 670,
  premium: 1250,
  /** Différence Membre vers Premium. */
  upgrade: 580,
} as const;

export const LUNCH_STEPS: ReadonlyArray<{ title: string; text: string }> = [
  { title: "Cercle d’ouverture", text: "Chacune se présente en une phrase : prénom, métier, depuis quand à Marrakech." },
  { title: "Speed networking en duo", text: "Huit minutes à deux, puis on change. Pas de badge, pas de pitch forcé." },
  { title: "Boîte à questions", text: "Les questions qu’on n’ose pas poser : visa, banque, école, clientèle." },
  { title: "Outils concrets", text: "Chacune repart avec trois contacts et une adresse à tester." },
];

export const QUOTE = {
  text: "« C’est plus qu’un club. C’est une communauté en pleine construction, humaine, chaleureuse, sans prétention mais avec beaucoup d’âme. »",
  author: "Nora, cofondatrice",
};

export const HERO = {
  eyebrow: "Club femmes & entrepreneuses à Marrakech",
  titleA: "Le plus difficile n’est pas de changer de pays.",
  titleB: "C’est de reconstruire un cercle.",
  text: "Le Nomad Club réunit des femmes de tous horizons qui ont choisi de construire leur réseau, créer de vraies amitiés et vivre pleinement leur aventure à Marrakech.",
};

export const AI_SUGGESTIONS = [
  "Une adresse pour un brunch à Guéliz ?",
  "Visa et carte de séjour",
  "Ouvrir un compte en banque",
  "Une école pour mes enfants ?",
  "Où jouer au padel ?",
  "C’est quand le prochain lunch ?",
];

export const PLACE_FILTERS = [
  { key: "tout", label: "Tout" },
  { key: "club", label: "Le club y était" },
  { key: "manger", label: "Manger" },
  { key: "sortir", label: "Sortir" },
  { key: "hotels-piscines", label: "Hôtels et piscines" },
  { key: "bien-etre-sport", label: "Bien-être et sport" },
  { key: "beaute", label: "Beauté" },
  { key: "sante", label: "Santé" },
  { key: "urgences", label: "Urgences" },
  { key: "shopping", label: "Shopping" },
  { key: "pratique", label: "Pratique" },
  { key: "famille", label: "En famille" },
] as const;

export type PlaceFilterKey = (typeof PLACE_FILTERS)[number]["key"];
