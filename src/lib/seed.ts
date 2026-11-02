/**
 * Données d'exemple du Nomad Club (mode démo).
 * Date de référence : mercredi 14 octobre 2026.
 * Ce fichier n'importe que des données (carnet-annuaire.ts) : il sert aussi à générer supabase/seed.sql
 * avec `npm run seed:sql`.
 */
import type {
  AppNotification,
  AuditEntry,
  Booking,
  ClubEvent,
  Membership,
  Memory,
  Message,
  NotificationPref,
  Organization,
  OrganizationMember,
  PartnerOffer,
  Payment,
  Place,
  Plan,
  Profile,
  Reminder,
} from "./types";
import { ANNUAIRE } from "./carnet-annuaire.ts";
// --- Lot 3 ---
import { partenairesSeed } from "./modules/partenaires/seed.ts";
import type { Offer, PartenairesSeed } from "./modules/partenaires/types.ts";
import { createEngagementSeed } from "./modules/engagement/seed.ts"; // --- Lot 4 ---
import type { EngagementSeed } from "./modules/engagement/types";
import { createCommunauteSeed } from "./modules/communaute/seed.ts"; // --- Lot 1 ---
import type { CommunauteData } from "./modules/communaute/types.ts";

export type SeedData = {
  profiles: Profile[];
  places: Place[];
  events: ClubEvent[];
  bookings: Booking[];
  payments: Payment[];
  memberships: Membership[];
  memories: Memory[];
  messages: Message[];
  reminders: Reminder[];
  partnerOffers: PartnerOffer[];
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  auditLog: AuditEntry[];
  notifications: AppNotification[];
  notificationPrefs: NotificationPref[];
  // --- Lot 3 --- (offres complètes, fiches, codes, statistiques, abonnements, positions)
  partenaires: PartenairesSeed & { offers: Offer[] };
  // --- Lot 4 ---
  engagement: EngagementSeed;
  /** Lot 1 — Communauté : actualités, groupes, modération, annuaire. */
  communaute: CommunauteData;
};

/** Identifiants fixes utilisés par le mode démo. */
export const DEMO_MEMBER_ID = "p-ines";
export const DEMO_FOUNDER_ID = "p-julia";
/** Kenza Lahlou : adhérente et partenaire (Bloom House). */
export const DEMO_PARTNER_ID = "p-g11";
/** Loubna Cherkaoui : adhérente et professionnelle du carnet (ostéopathe). */
export const DEMO_PRO_ID = "p-g34";

const iso = (ymd: string, time = "10:00") => new Date(`${ymd}T${time}:00+01:00`).toISOString();

function addYearsYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y + n}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* Petit générateur pseudo-aléatoire déterministe. */
function prng(seed: number) {
  let h = seed >>> 0;
  return () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
}

type P = Partial<Profile> & { id: string; firstName: string };

function profile(p: P): Profile {
  return {
    lastName: "",
    whatsapp: null,
    email: null,
    job: null,
    country: null,
    bio: null,
    roles: ["member"],
    plan: "member" as Plan,
    planEndsAt: null,
    avatarUrl: null,
    marrakechSince: null,
    cardNumber: null,
    createdAt: iso("2024-01-10"),
    ...p,
  };
}

export function createSeed(): SeedData {
  const rnd = prng(20261014);
  const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const usedCodes = new Set<string>(["NC-2610-0427"]);
  const ticketCode = (startsAt: string) => {
    const d = new Date(startsAt);
    const ddmm =
      String(Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", day: "numeric" }).format(d))).padStart(2, "0") +
      new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", month: "2-digit" }).format(d);
    for (;;) {
      let s = "";
      for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)];
      const c = `NC-${ddmm}-${s}`;
      if (!usedCodes.has(c)) {
        usedCodes.add(c);
        return c;
      }
    }
  };
  const phone = () => {
    let s = "+212 6";
    for (let i = 0; i < 4; i++) s += " " + String(Math.floor(rnd() * 90) + 10);
    return s;
  };

  /* ---------------- profils ---------------- */
  const named: Profile[] = [
    profile({ id: "p-julia", firstName: "Julia", roles: ["admin"], plan: "premium", planEndsAt: "2027-09-01", job: "Cofondatrice du Nomad Club", country: "Française", marrakechSince: "2019", email: "julia@exemple.com", cardNumber: "NC 0001", createdAt: iso("2019-09-01") }),
    profile({ id: "p-nora", firstName: "Nora", roles: ["admin"], plan: "premium", planEndsAt: "2027-09-01", job: "Cofondatrice du Nomad Club", country: "Franco-marocaine", marrakechSince: "2017", email: "nora@exemple.com", cardNumber: "NC 0002", createdAt: iso("2019-09-01") }),
    profile({ id: "p-ines", firstName: "Inès", lastName: "Laurent", plan: "member", planEndsAt: "2026-11-18", job: "Consultante en communication", country: "Française", marrakechSince: "2025", email: "ines@exemple.com", whatsapp: "+212 6 61 42 18 07", cardNumber: "NC 0427", bio: "Je conseille des marques qui s’installent au Maroc.", createdAt: iso("2025-11-18") }),
    profile({ id: "p-yasmine", firstName: "Yasmine", lastName: "Tazi", roles: ["member", "moderator"], plan: "premium", planEndsAt: "2026-11-02", job: "Avocate d’affaires", country: "Marocaine", marrakechSince: "toujours", cardNumber: "NC 0112", createdAt: iso("2020-11-02") }),
    profile({ id: "p-salma", firstName: "Salma", lastName: "Alaoui", plan: "premium", planEndsAt: "2026-10-24", job: "Architecte d’intérieur", country: "Marocaine", marrakechSince: "2021", cardNumber: "NC 0145", createdAt: iso("2021-10-24") }),
    profile({ id: "p-maya", firstName: "Maya", lastName: "Benkirane", plan: "premium", planEndsAt: "2026-10-08", job: "Directrice artistique", country: "Marocaine", marrakechSince: "2023", cardNumber: "NC 0298", createdAt: iso("2023-10-08") }),
    profile({ id: "p-chloe", firstName: "Chloé", lastName: "Martin", plan: "member", planEndsAt: "2026-10-19", job: "Photographe", country: "Française", marrakechSince: "2024", cardNumber: "NC 0351", createdAt: iso("2024-10-19") }),
    profile({ id: "p-nadia", firstName: "Nadia", lastName: "Kettani", plan: "member", planEndsAt: "2027-03-03", job: "Créatrice de cosmétiques", country: "Marocaine et canadienne", marrakechSince: "2022", cardNumber: "NC 0207", createdAt: iso("2022-03-03") }),
    profile({ id: "p-lou", firstName: "Lou", lastName: "Garnier", plan: "member", planEndsAt: "2026-10-06", job: "Coach parentale", country: "Belge", marrakechSince: "2025", cardNumber: "NC 0402", createdAt: iso("2025-10-06") }),
    profile({ id: "p-leila", firstName: "Leïla", lastName: "Benjelloun", plan: "member", planEndsAt: "2026-10-01", job: "Professeure de yoga", country: "Franco-marocaine", marrakechSince: "2020", cardNumber: "NC 0133", createdAt: iso("2020-10-01") }),
    profile({ id: "p-emma", firstName: "Emma", lastName: "Schneider", plan: "member", planEndsAt: "2026-09-21", job: "Traductrice", country: "Allemande", marrakechSince: "2024", cardNumber: "NC 0344", createdAt: iso("2024-09-21") }),
    profile({ id: "p-capucine", firstName: "Capucine", lastName: "Dubois", plan: "member", planEndsAt: "2027-01-14", job: "Décoratrice", country: "Française", marrakechSince: "2025", cardNumber: "NC 0433", createdAt: iso("2026-01-14") }),
    profile({ id: "p-nawal", firstName: "Nawal", lastName: "Garcia", plan: "member", planEndsAt: "2027-02-02", job: "Cheffe de projet digital", country: "Hispano-marocaine", marrakechSince: "2023", cardNumber: "NC 0286", createdAt: iso("2023-02-02") }),
    profile({ id: "p-justine", firstName: "Justine", lastName: "Rochette", plan: "member", planEndsAt: "2026-11-26", job: "Kinésithérapeute", country: "Suisse", marrakechSince: "2024", cardNumber: "NC 0365", createdAt: iso("2024-11-26") }),
    profile({ id: "p-sophie", firstName: "Sophie", lastName: "Lambert", plan: "member", planEndsAt: "2026-10-28", job: "Consultante RH", country: "Française", marrakechSince: "2023", cardNumber: "NC 0261", createdAt: iso("2023-10-28") }),
    profile({ id: "p-karima", firstName: "Karima", lastName: "Bennani", plan: "member", planEndsAt: "2026-11-05", job: "Fondatrice d’un concept-store", country: "Marocaine", marrakechSince: "2022", cardNumber: "NC 0219", createdAt: iso("2022-11-05") }),
    profile({ id: "p-anais", firstName: "Anaïs", lastName: "Roux", plan: "premium", planEndsAt: "2026-11-11", job: "Directrice d’hôtel", country: "Française", marrakechSince: "2021", cardNumber: "NC 0158", createdAt: iso("2021-11-11") }),
    profile({ id: "p-aurelie", firstName: "Aurélie", lastName: "Petit", plan: "member", planEndsAt: "2026-09-28", job: "Développeuse web", country: "Française", marrakechSince: "2024", cardNumber: "NC 0347", createdAt: iso("2024-09-28") }),
    profile({ id: "p-ambre", firstName: "Ambre", lastName: "Fontaine", plan: "member", planEndsAt: "2027-10-02", job: "Coach en image", country: "Belge", marrakechSince: "2026", cardNumber: "NC 0458", createdAt: iso("2026-10-02") }),
    profile({ id: "p-hana", firstName: "Hana", lastName: "Idrissi", roles: [], plan: "free", job: "Ingénieure", country: "Marocaine", createdAt: iso("2026-06-12") }),
    profile({ id: "p-clara", firstName: "Clara", lastName: "Moreau", roles: [], plan: "free", job: "Graphiste", country: "Française", createdAt: iso("2026-09-08") }),
    profile({ id: "p-sarah", firstName: "Sarah", lastName: "Cohen", roles: [], plan: "free", job: "Consultante en marketing", country: "Française", createdAt: iso("2026-09-24") }),
  ];

  /* 49 autres adhérentes actives (dont 21 Premium) pour retrouver les chiffres du club : 61 actives, 24 Premium. */
  const FIRST = ["Lina", "Amina", "Sofia", "Camille", "Rania", "Laura", "Ghita", "Manon", "Imane", "Julie", "Kenza", "Élise", "Salomé", "Zineb", "Pauline", "Meriem", "Charlotte", "Hind", "Margaux", "Soukaina", "Agathe", "Dounia", "Victoire", "Asmae", "Clémence", "Houda", "Alice", "Naima", "Juliette", "Fatima-Zahra", "Romane", "Sanaa", "Mathilde", "Loubna", "Eva", "Ikram", "Héloïse", "Btissam", "Léa", "Yousra", "Bérénice", "Malak", "Constance", "Chaïma", "Anouk", "Souad", "Gabrielle", "Widad", "Inaya"];
  const LAST = ["Haddad", "Berrada", "El Amrani", "Lefèvre", "Chraibi", "Bernard", "Fassi", "Girard", "Sqalli", "Moulin", "Lahlou", "Fournier", "Bennis", "Guerin", "Tahiri", "Rousseau", "Ouazzani", "Blanc", "Skalli", "Henry", "Kabbaj", "Garnier", "Zniber", "Faure", "Alami", "Mercier", "Benjelloun", "Dupont", "Sefrioui", "Lambert", "Bouzidi", "Morel", "Cherkaoui", "Chevalier", "Filali", "Robin", "Kadiri", "Masson", "Ziani", "Perrin", "Amrani", "Leroy", "Tazi", "Marchand", "Idrissi", "Colin", "Hajji", "Roche", "Naciri"];
  const JOBS = ["Fondatrice d’une agence de voyages", "Avocate", "Cheffe pâtissière", "Consultante en stratégie", "Architecte", "Coach de vie", "Designer textile", "Journaliste", "Psychologue", "Créatrice de bijoux", "Experte-comptable", "Professeure de français", "Responsable marketing", "Ostéopathe", "Photographe culinaire", "Fondatrice d’une marque de céramique", "Ingénieure", "Directrice de crèche", "Organisatrice de mariages", "Développeuse"];
  const COUNTRIES = ["Française", "Marocaine", "Belge", "Franco-marocaine", "Suisse", "Canadienne", "Italienne", "Espagnole", "Britannique", "Libanaise"];
  const ENDS = [
    "2026-11-21",
    "2026-12-03", "2026-12-09", "2026-12-15", "2026-12-22",
    "2027-01-05", "2027-01-08", "2027-01-19", "2027-01-22", "2027-01-26", "2027-01-29",
    "2027-02-17",
    "2027-03-06", "2027-03-12", "2027-03-20", "2027-03-27",
  ];
  for (let k = 0; ENDS.length < 49; k++) {
    const month = 4 + (k % 6);
    const day = 2 + ((k * 5) % 26);
    ENDS.push(`2027-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  const generated: Profile[] = ENDS.map((end, i) => {
    const premium = [0, 2, 4].includes(i % 7);
    const created = i < 25 ? addYearsYmd(end, -1) : addYearsYmd(end, -3);
    return profile({
      id: `p-g${String(i + 1).padStart(2, "0")}`,
      firstName: FIRST[i],
      lastName: LAST[i],
      plan: premium ? "premium" : "member",
      planEndsAt: end,
      job: JOBS[i % JOBS.length],
      country: COUNTRIES[(i * 3) % COUNTRIES.length],
      marrakechSince: String(Number(created.slice(0, 4)) - (i % 3)),
      whatsapp: phone(),
      cardNumber: `NC 0${500 + i}`,
      createdAt: iso(created),
    });
  });
  // Rôles cumulés : Kenza est aussi partenaire (Bloom House), Loubna professionnelle du carnet.
  Object.assign(generated[10], { roles: ["member", "partner"], job: "Fondatrice de Bloom House", email: "kenza@exemple.com" });
  Object.assign(generated[33], { roles: ["member", "pro"], lastName: "Cherkaoui", job: "Ostéopathe", email: "loubna@exemple.com" });
  // Rim gère Maison Amaj : partenaire sans adhésion.
  const rim = profile({ id: "p-rim", firstName: "Rim", lastName: "Amajjar", roles: ["partner"], plan: "free", job: "Gérante de Maison Amaj", country: "Marocaine", email: "rim@exemple.com", createdAt: iso("2026-05-20") });
  const profiles = [...named, ...generated, rim];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const name = (id: string) => {
    const p = byId.get(id)!;
    return [p.firstName, p.lastName].filter(Boolean).join(" ");
  };
  const premiumGen = generated.filter((p) => p.plan === "premium");
  const memberGen = generated.filter((p) => p.plan === "member");

  /* ---------------- carnet ---------------- */
  const clubPlaces: Omit<Place, "phone" | "address" | "hours" | "tags" | "badge">[] = [
    { id: "pl-fer7", slug: "fer7", name: "Fer7", kind: "Restaurant", area: "Golf, route d’Amizmiz", note: "Izakaya face aux greens. Notre lunch du lundi.", categories: ["manger"], recommendedBy: "Julia", clubEventLabel: "Lunch Raffiné & Networking", clubEventDate: "2026-01-26", url: null, image: "lunch-fer7.jpg", imagePosition: "40% 45%" },
    { id: "pl-amaj", slug: "maison-amaj", name: "Maison Amaj", kind: "Pâtisserie, petit-déjeuner", area: "Guéliz", note: "L’adresse de Mounir El Fahsi, vainqueur du Meilleur Pâtissier.", categories: ["manger", "famille"], recommendedBy: "Nora", clubEventLabel: "Petit-déjeuner, édition mixte", clubEventDate: "2026-08-04", url: null, image: null, imagePosition: null },
    { id: "pl-padel", slug: "urban-padel", name: "Urban Padel", kind: "Sport", area: "Targa", note: "Nos tournois féminins. Réserve le terrain 3 jours avant.", categories: ["bien-etre-sport"], recommendedBy: "Julia", clubEventLabel: "Tournoi de padel féminin", clubEventDate: "2026-08-08", url: null, image: "padel.jpg", imagePosition: "50% 90%" },
    { id: "pl-terraza", slug: "la-terraza", name: "La Terraza", kind: "Rooftop", area: "Guéliz", note: "Le toit du lancement de saison. Coucher de soleil sur l’Atlas.", categories: ["sortir"], recommendedBy: "Nora", clubEventLabel: "Lancement de la saison", clubEventDate: "2026-09-24", url: null, image: "saison-la-terraza.jpg", imagePosition: "50% 62%" },
    { id: "pl-yemna", slug: "villa-yemna", name: "Villa Yemna", kind: "Lieu de réception", area: "Palmeraie", note: "Notre premier iftar, une table de trente.", categories: ["sortir"], recommendedBy: "Nora", clubEventLabel: "Iftar du Nomad Club", clubEventDate: "2026-03-13", url: null, image: "iftar-villa-yemna.jpg", imagePosition: "50% 55%" },
    { id: "pl-terrajana", slug: "terrajana", name: "Terrajana", kind: "Dîner, jardin", area: "Route de l’Ourika", note: "Grande table dans le jardin, idéal pour 20 personnes.", categories: ["manger", "sortir"], recommendedBy: "Julia", clubEventLabel: "Dîner d’exception", clubEventDate: "2026-05-04", url: null, image: "diner-terrajana.jpg", imagePosition: "50% 55%" },
    { id: "pl-bloom", slug: "bloom-house", name: "Bloom House", kind: "Bien-être", area: "Guéliz", note: "Conférences et ateliers, une terrasse très calme.", categories: ["bien-etre-sport"], recommendedBy: "Nora", clubEventLabel: null, clubEventDate: null, url: null, image: null, imagePosition: null },
    { id: "pl-chonchon", slug: "chonchon-chocolat", name: "Chonchon & Chocolat", kind: "Brunch", area: "Guéliz", note: "Grande tablée, parfait pour un brunch à quinze.", categories: ["manger", "famille"], recommendedBy: "Julia", clubEventLabel: "Brunch de fin d’année", clubEventDate: "2025-12-14", url: null, image: "chonchon-chocolat.jpg", imagePosition: "50% 28%" },
    { id: "pl-ranch", slug: "the-ranch-morocco", name: "The Ranch Morocco", kind: "Famille", area: "Route de l’Ourika", note: "Ferme pédagogique et poneys, les enfants adorent.", categories: ["famille"], recommendedBy: "Nora", clubEventLabel: null, clubEventDate: null, url: null, image: null, imagePosition: null },
    { id: "pl-avabay", slug: "avabay", name: "AVABAY", kind: "Brunch, lieu d’événement", area: "Palmeraie", note: "Un lieu qui invite à ralentir. Notre brunch neurosciences.", categories: ["manger", "sortir"], recommendedBy: "Julia", clubEventLabel: "Brunch Networking & Neurosciences", clubEventDate: "2026-10-11", url: null, image: null, imagePosition: null },
  ];
  const places: Place[] = [...clubPlaces.map((p) => ({ ...p, phone: null, address: null, hours: null, tags: [], badge: null })), ...ANNUAIRE];

  /* ---------------- rendez-vous ---------------- */
  const LUNCH = [
    "Chacune se présente en une phrase : prénom, métier, depuis quand à Marrakech.",
    "Huit minutes à deux, puis on change. Pas de badge, pas de pitch forcé.",
    "Les questions qu’on n’ose pas poser : visa, banque, école, clientèle.",
    "Chacune repart avec trois contacts et une adresse à tester.",
  ];
  const events: ClubEvent[] = [
    {
      id: "ev-body", slug: "body-experience", title: "BODY Expérience", shortTitle: "BODY Expérience",
      startsAt: iso("2026-10-19", "14:00"), endsAt: iso("2026-10-19", "18:00"), placeId: null, venue: "Body Agency", address: "Marrakech",
      description: "Un après-midi rien que pour toi avec l’équipe de Body Agency : bilan, soins et conseils de coach, en petit comité.",
      program: [
        { time: "14 h", title: "Accueil et thé", text: "On se pose, on se présente." },
        { time: "14 h 30", title: "Bilan personnalisé", text: "Un échange en tête-à-tête avec une coach." },
        { time: "15 h 30", title: "Soins et ateliers", text: "Par petits groupes, à ton rythme." },
        { time: "17 h 30", title: "Moment calme", text: "On partage ses impressions avant de repartir." },
      ],
      capacity: 15, pricePublic: 0, priceMember: 0, premiumFree: true, status: "published",
      image: "body-agency.jpg", imagePosition: "18% 80%", imageZoom: "--z:1.7;--zo:22% 88%", imageCaption: "BODY Expérience, Body Agency", featured: false, createdAt: iso("2026-09-15"),
    },
    {
      id: "ev-fer7", slug: "lunch-raffine-networking", title: "Lunch Raffiné & Networking", shortTitle: "Lunch au Fer7",
      startsAt: iso("2026-10-26", "12:00"), endsAt: iso("2026-10-26", "15:00"), placeId: "pl-fer7", venue: "Fer7", address: "Golf, route d’Amizmiz",
      description: "Une table face aux greens et aux palmiers, des saveurs asiatiques à partager, et des rencontres qui comptent.",
      program: [
        { time: "12 h", title: "Cercle d’ouverture", text: LUNCH[0] },
        { time: "12 h 30", title: "Speed networking en duo", text: LUNCH[1] },
        { time: "13 h 30", title: "Boîte à questions", text: LUNCH[2] },
        { time: "14 h 30", title: "Outils concrets", text: LUNCH[3] },
      ],
      capacity: 12, pricePublic: 60, priceMember: 50, premiumFree: false, status: "published",
      image: "lunch-fer7.jpg", imagePosition: "40% 50%", imageZoom: null, imageCaption: "Fer7, table face au golf", featured: true, createdAt: iso("2026-09-20"),
    },
    {
      id: "ev-padel", slug: "tournoi-padel-feminin", title: "Tournoi de padel féminin", shortTitle: "Padel à Urban Padel",
      startsAt: iso("2026-11-07", "09:30"), endsAt: null, placeId: "pl-padel", venue: "Urban Padel", address: "Targa",
      description: "Un tournoi en double, tous niveaux, dans la bonne humeur. On mélange les équipes pour que chacune rencontre de nouvelles joueuses.",
      program: [
        { time: "9 h 30", title: "Échauffement", text: "Les équipes sont tirées au sort." },
        { time: "10 h", title: "Matchs de poules", text: "Des matchs courts, tout le monde joue." },
        { time: "12 h", title: "Finale", text: "On encourage les finalistes." },
        { time: "12 h 45", title: "Brunch au club-house", text: "Remise des prix et photo de groupe." },
      ],
      capacity: 8, pricePublic: 30, priceMember: 25, premiumFree: false, status: "published",
      image: "padel.jpg", imagePosition: "50% 92%", imageZoom: "--z:1.9;--zo:50% 88%", imageCaption: "Tournoi de padel, Urban Padel", featured: false, createdAt: iso("2026-09-10"),
    },
    {
      id: "ev-diner", slug: "diner-prive-terrajana", title: "Dîner privé", shortTitle: "Dîner à Terrajana",
      startsAt: iso("2026-11-19", "19:30"), endsAt: null, placeId: "pl-terrajana", venue: "Terrajana", address: "Route de l’Ourika",
      description: "Une grande table dressée dans le jardin de Terrajana, un menu de saison et une soirée pour prendre le temps.",
      program: [
        { time: "19 h 30", title: "Apéritif au jardin", text: "Les présentations se font autour des lanternes." },
        { time: "20 h 15", title: "Grande table", text: "Placement mélangé, pour rencontrer de nouvelles têtes." },
        { time: "22 h", title: "Dessert et thé", text: "On termine doucement, sous les étoiles." },
      ],
      capacity: 20, pricePublic: 90, priceMember: 75, premiumFree: false, status: "published",
      image: "diner-terrajana.jpg", imagePosition: "50% 58%", imageZoom: null, imageCaption: "Dîner privé, Terrajana", featured: false, createdAt: iso("2026-09-25"),
    },
    {
      id: "ev-family", slug: "family-day", title: "Family Day", shortTitle: "Family Day",
      startsAt: iso("2026-11-29", "11:00"), endsAt: iso("2026-11-29", "16:00"), placeId: "pl-ranch", venue: "The Ranch Morocco", address: "Route de l’Ourika",
      description: "Une journée à la ferme avec les enfants : poneys, pique-nique et ateliers.",
      program: [], capacity: 30, pricePublic: 40, priceMember: 30, premiumFree: false, status: "draft",
      image: null, imagePosition: null, imageZoom: null, imageCaption: null, featured: false, createdAt: iso("2026-10-05"),
    },
    {
      id: "ev-chill", slug: "chill-connect-hiver", title: "Chill & Connect, édition d’hiver", shortTitle: "Chill & Connect",
      startsAt: iso("2026-12-12", "16:00"), endsAt: null, placeId: null, venue: null, address: null,
      description: "Un après-midi doux pour se retrouver avant les fêtes.",
      program: [], capacity: 20, pricePublic: 40, priceMember: 30, premiumFree: false, status: "draft",
      image: "chill-connect-groupe.jpg", imagePosition: "50% 60%", imageZoom: null, imageCaption: "Chill & Connect, Palmeraie", featured: false, createdAt: iso("2026-10-07"),
    },
  ];
  const ev = new Map(events.map((e) => [e.id, e]));

  /* ---------------- réservations et paiements ---------------- */
  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  let bk = 0;
  let pay = 0;
  const book = (o: {
    eventId: string;
    profileId?: string;
    guest?: string;
    status: Booking["status"];
    amount: number;
    method: Booking["method"];
    day: string;
    code?: string;
    paymentStatus?: "validated" | "declared";
  }) => {
    const e = ev.get(o.eventId)!;
    const b: Booking = {
      id: `bk-${++bk}`,
      eventId: o.eventId,
      profileId: o.profileId ?? null,
      guestFirstName: o.guest ?? null,
      guestWhatsapp: o.guest ? phone() : null,
      status: o.status,
      amount: o.amount,
      method: o.method,
      ticketCode: o.code ?? ticketCode(e.startsAt),
      stripeSessionId: null,
      createdAt: iso(o.day, "11:00"),
    };
    bookings.push(b);
    if (o.paymentStatus) {
      payments.push({
        id: `pay-${++pay}`,
        profileId: o.profileId ?? null,
        payerName: o.profileId ? name(o.profileId) : o.guest!,
        kind: "booking",
        bookingId: b.id,
        plan: null,
        membershipAction: null,
        amount: o.amount,
        method: o.method,
        status: o.paymentStatus,
        declaredAt: iso(o.day, "11:00"),
        validatedAt: o.paymentStatus === "validated" ? iso(o.day, "11:05") : null,
        validatedBy: null,
        stripeSessionId: null,
      });
    }
    return b;
  };

  // BODY Expérience : 11 Premium, offert.
  ["p-yasmine", "p-salma", "p-anais", ...premiumGen.slice(0, 8).map((p) => p.id)].forEach((id, i) =>
    book({ eventId: "ev-body", profileId: id, status: "offered", amount: 0, method: "free", day: `2026-09-${String(16 + i).padStart(2, "0")}` }),
  );

  // Lunch au Fer7 : 8 payées, 3 en attente (dont un virement déclaré).
  book({ eventId: "ev-fer7", profileId: "p-ines", status: "paid", amount: 50, method: "card", day: "2026-10-08", code: "NC-2610-0427", paymentStatus: "validated" });
  memberGen.slice(0, 5).forEach((p, i) =>
    book({ eventId: "ev-fer7", profileId: p.id, status: "paid", amount: 50, method: "card", day: `2026-10-0${3 + i}`, paymentStatus: "validated" }),
  );
  book({ eventId: "ev-fer7", guest: "Mélanie", status: "paid", amount: 60, method: "card", day: "2026-10-05", paymentStatus: "validated" });
  book({ eventId: "ev-fer7", guest: "Rim", status: "paid", amount: 60, method: "card", day: "2026-10-09", paymentStatus: "validated" });
  book({ eventId: "ev-fer7", profileId: "p-nadia", status: "pending", amount: 50, method: "transfer", day: "2026-10-12", paymentStatus: "declared" });
  book({ eventId: "ev-fer7", profileId: "p-nawal", status: "pending", amount: 50, method: "card", day: "2026-10-10" });
  book({ eventId: "ev-fer7", profileId: "p-capucine", status: "pending", amount: 50, method: "card", day: "2026-10-11" });

  // Padel : complet, 1 impayée, 3 en liste d'attente.
  book({ eventId: "ev-padel", profileId: "p-karima", status: "paid", amount: 25, method: "card", day: "2026-10-06", paymentStatus: "validated" });
  memberGen.slice(5, 8).forEach((p, i) =>
    book({ eventId: "ev-padel", profileId: p.id, status: "paid", amount: 25, method: "card", day: `2026-10-0${2 + i}`, paymentStatus: "validated" }),
  );
  book({ eventId: "ev-padel", guest: "Ghita", status: "paid", amount: 30, method: "card", day: "2026-10-07", paymentStatus: "validated" });
  book({ eventId: "ev-padel", profileId: memberGen[8].id, status: "paid", amount: 25, method: "card", day: "2026-09-18", paymentStatus: "validated" });
  book({ eventId: "ev-padel", guest: "Océane", status: "paid", amount: 30, method: "card", day: "2026-09-22", paymentStatus: "validated" });
  book({ eventId: "ev-padel", profileId: "p-g01", status: "pending", amount: 25, method: "card", day: "2026-10-09" });
  ["Mélissa", "Kawtar", "Jeanne"].forEach((g, i) =>
    book({ eventId: "ev-padel", guest: g, status: "waitlist", amount: 0, method: "card", day: `2026-10-1${i}` }),
  );

  // Dîner privé : 4 payées.
  book({ eventId: "ev-diner", profileId: "p-sophie", status: "paid", amount: 75, method: "card", day: "2026-10-12", paymentStatus: "validated" });
  book({ eventId: "ev-diner", profileId: "p-hana", status: "paid", amount: 90, method: "card", day: "2026-10-10", paymentStatus: "validated" });
  book({ eventId: "ev-diner", profileId: memberGen[9].id, status: "paid", amount: 75, method: "card", day: "2026-09-27", paymentStatus: "validated" });
  book({ eventId: "ev-diner", guest: "Selma", status: "paid", amount: 90, method: "card", day: "2026-09-29", paymentStatus: "validated" });

  /* Adhésions : historique des 12 derniers mois + virements déclarés. */
  const membershipPay = (o: { profileId: string | null; payer: string; plan: "member" | "premium"; action: Payment["membershipAction"]; amount: number; day: string; status: "validated" | "declared"; method?: Payment["method"] }) =>
    payments.push({
      id: `pay-${++pay}`,
      profileId: o.profileId,
      payerName: o.payer,
      kind: "membership",
      bookingId: null,
      plan: o.plan,
      membershipAction: o.action,
      amount: o.amount,
      method: o.method ?? "transfer",
      status: o.status,
      declaredAt: iso(o.day, "09:30"),
      validatedAt: o.status === "validated" ? iso(o.day, "18:00") : null,
      validatedBy: o.status === "validated" ? "p-nora" : null,
      stripeSessionId: null,
    });

  membershipPay({ profileId: "p-ambre", payer: "Ambre Fontaine", plan: "member", action: "join", amount: 670, day: "2026-10-02", status: "validated", method: "card" });
  membershipPay({ profileId: "p-lou", payer: "Lou Garnier", plan: "member", action: "renew", amount: 670, day: "2026-10-11", status: "declared" });
  membershipPay({ profileId: "p-maya", payer: "Maya Benkirane", plan: "premium", action: "renew", amount: 1250, day: "2026-10-09", status: "declared" });

  // Historique mensuel (novembre 2025 à septembre 2026) : adhésions et billets d'anciens rendez-vous.
  const HISTORY: Array<{ ym: string; adh: number[]; tickets: number }> = [
    { ym: "2025-11", adh: [670, 670, 670], tickets: 1890 },
    { ym: "2025-12", adh: [670, 670, 670, 670, 670], tickets: 1850 },
    { ym: "2026-01", adh: [670, 670, 670, 670, 670, 670, 670, 670, 670], tickets: 2780 },
    { ym: "2026-02", adh: [670, 670, 670], tickets: 2090 },
    { ym: "2026-03", adh: [670, 670, 670, 670, 670, 670, 670], tickets: 2610 },
    { ym: "2026-04", adh: [670, 670, 670, 670], tickets: 1920 },
    { ym: "2026-05", adh: [670, 670, 670, 670], tickets: 2320 },
    { ym: "2026-06", adh: [670, 1250], tickets: 2480 },
    { ym: "2026-07", adh: [670, 670], tickets: 1860 },
    { ym: "2026-08", adh: [670, 670, 1250], tickets: 2010 },
    // septembre : 220 $ de billets déjà comptés via les réservations ci-dessus
    { ym: "2026-09", adh: [1250, 1250, 1250, 670, 670], tickets: 3260 - 220 },
  ];
  const COINS = [25, 30, 50, 60, 75, 90];
  const splitTickets = (total: number): number[] => {
    const out: number[] = [];
    const cycle = [60, 50, 60, 50, 75, 90, 50, 30, 25, 60];
    let rest = total;
    let c = 0;
    while (rest >= 300) {
      out.push(cycle[c % cycle.length]);
      rest -= cycle[c % cycle.length];
      c++;
    }
    // reste : petit rendu de monnaie exact
    const best: Array<number[] | null> = Array(rest + 1).fill(null);
    best[0] = [];
    for (let v = 1; v <= rest; v++) {
      for (const coin of COINS) {
        if (coin <= v && best[v - coin] && (!best[v] || best[v - coin]!.length + 1 < best[v]!.length)) best[v] = [...best[v - coin]!, coin];
      }
    }
    if (!best[rest]) throw new Error("Montant de billets non décomposable : " + total);
    return [...out, ...best[rest]!];
  };
  let payerIdx = 0;
  const nextPayer = () => generated[payerIdx++ % generated.length];
  for (const h of HISTORY) {
    h.adh.forEach((amount, i) => {
      const p = nextPayer();
      membershipPay({ profileId: p.id, payer: name(p.id), plan: amount === 1250 ? "premium" : "member", action: i % 3 === 0 ? "join" : "renew", amount, day: `${h.ym}-${String(3 + ((i * 7) % 24)).padStart(2, "0")}`, status: "validated" });
    });
    splitTickets(h.tickets).forEach((amount, i) => {
      const p = nextPayer();
      payments.push({
        id: `pay-${++pay}`,
        profileId: p.id,
        payerName: name(p.id),
        kind: "booking",
        bookingId: null,
        plan: null,
        membershipAction: null,
        amount,
        method: "card",
        status: "validated",
        declaredAt: iso(`${h.ym}-${String(1 + ((i * 3) % 27)).padStart(2, "0")}`, "12:00"),
        validatedAt: iso(`${h.ym}-${String(1 + ((i * 3) % 27)).padStart(2, "0")}`, "12:00"),
        validatedBy: null,
        stripeSessionId: null,
      });
    });
  }

  /* ---------------- adhésions (périodes) ---------------- */
  const memberships: Membership[] = profiles
    .filter((p) => p.plan !== "free" && p.planEndsAt)
    .map((p, i) => ({
      id: `ms-${i + 1}`,
      profileId: p.id,
      plan: p.plan as "member" | "premium",
      startsAt: addYearsYmd(p.planEndsAt!, -1),
      endsAt: p.planEndsAt!,
      status: p.planEndsAt! >= "2026-10-14" ? "active" : "expired",
    }));

  /* ---------------- souvenirs ---------------- */
  const memories: Memory[] = [
    { id: "mem-padel", title: "Tournoi de padel féminin", place: "Urban Padel", dateLabel: "Août 2026", participants: 15, image: "padel.jpg", imagePosition: "50% 95%", attendees: ["Salma Alaoui", "Chloé Martin", "Lou Garnier", "Maya Benkirane"], sortOrder: 1 },
    { id: "mem-chill", title: "Chill & Connect", place: "Palmeraie", dateLabel: "Juin 2026", participants: 14, image: "chill-connect-groupe.jpg", imagePosition: "50% 60%", attendees: ["Nadia Kettani", "Yasmine Tazi", "Emma Schneider", "Leïla Benjelloun"], sortOrder: 2 },
    { id: "mem-brunch", title: "Brunch de fin d’année", place: "Chonchon & Chocolat", dateLabel: "Décembre 2025", participants: 16, image: "chonchon-chocolat.jpg", imagePosition: "50% 30%", attendees: ["Capucine Dubois", "Nawal Garcia", "Justine Rochette", "Inès Laurent"], sortOrder: 3 },
  ];

  /* ---------------- salon et messages ---------------- */
  const dm = (a: string, b: string) => "dm:" + [a, b].sort().join(":");
  const messages: Message[] = [
    { id: "msg-1", channel: "general", authorId: "p-salma", body: "Une idée de livre pour le club de lecture de novembre ?", createdAt: iso("2026-10-14", "09:40"), readAt: null },
    { id: "msg-2", channel: "general", authorId: "p-yasmine", body: "« Thinking, Fast and Slow », de Kahneman. Je peux prêter mon exemplaire.", createdAt: iso("2026-10-14", "09:52"), readAt: null },
    { id: "msg-3", channel: "general", authorId: "p-julia", body: "Rappel : BODY Expérience lundi 19, de 14 h à 18 h. Réservé aux Premium, il reste 4 places.", createdAt: iso("2026-10-14", "10:05"), readAt: null },
    { id: "msg-4", channel: dm("p-ines", "p-julia"), authorId: "p-julia", body: "Bienvenue encore, Inès ! Dis-moi si tu cherches une adresse ou un contact.", createdAt: iso("2026-10-12", "09:10"), readAt: iso("2026-10-12", "09:30") },
    { id: "msg-5", channel: dm("p-ines", "p-julia"), authorId: "p-ines", body: "Merci Julia, à très vite au Fer7 !", createdAt: iso("2026-10-12", "09:32"), readAt: iso("2026-10-12", "10:00") },
    { id: "msg-6", channel: dm("p-ines", "p-salma"), authorId: "p-salma", body: "On se met à côté au lunch ? Je voudrais te présenter une amie qui lance son agence.", createdAt: iso("2026-10-13", "18:40"), readAt: null },
    { id: "msg-7", channel: dm("p-ines", "p-yasmine"), authorId: "p-yasmine", body: "Coucou Inès ! Tu veux toujours le Kahneman ? Je peux te le déposer au Fer7 lundi 26.", createdAt: iso("2026-10-14", "10:11"), readAt: null },
  ];

  /* ---------------- relances ---------------- */
  const reminders: Reminder[] = [
    { id: "rem-1", profileId: "p-chloe", eventId: null, reason: "renewal", dueAt: "2026-10-19", sentAt: iso("2026-09-19", "10:00"), answered: false, scheduledFor: null },
    { id: "rem-2", profileId: "p-salma", eventId: null, reason: "renewal", dueAt: "2026-10-24", sentAt: iso("2026-09-24", "10:00"), answered: false, scheduledFor: null },
    { id: "rem-3", profileId: "p-leila", eventId: null, reason: "expired", dueAt: "2026-10-01", sentAt: iso("2026-10-01", "10:00"), answered: false, scheduledFor: null },
    { id: "rem-4", profileId: "p-emma", eventId: null, reason: "expired", dueAt: "2026-09-21", sentAt: iso("2026-09-21", "10:00"), answered: false, scheduledFor: null },
    { id: "rem-5", profileId: "p-salma", eventId: null, reason: "renewal", dueAt: "2026-10-24", sentAt: null, answered: false, scheduledFor: "2026-10-17" },
    { id: "rem-6", profileId: "p-chloe", eventId: null, reason: "renewal", dueAt: "2026-10-19", sentAt: null, answered: false, scheduledFor: "2026-10-18" },
    { id: "rem-7", profileId: "p-ines", eventId: null, reason: "renewal", dueAt: "2026-11-18", sentAt: null, answered: false, scheduledFor: "2026-10-19" },
    { id: "rem-8", profileId: "p-salma", eventId: null, reason: "renewal", dueAt: "2026-10-24", sentAt: null, answered: false, scheduledFor: "2026-10-23" },
    { id: "rem-9", profileId: "p-justine", eventId: null, reason: "renewal", dueAt: "2026-11-26", sentAt: null, answered: false, scheduledFor: "2026-10-26" },
  ];

  const partnerOffers: PartnerOffer[] = [
    { id: "off-bloom", badge: "-15 %", partner: "Bloom House", detail: "Sur les ateliers et conférences", organizationId: "org-bloom" },
    { id: "off-amaj", badge: "Café", partner: "Maison Amaj", detail: "Un café offert avec ta viennoiserie", organizationId: "org-amaj" },
    { id: "off-padel", badge: "1 h", partner: "Urban Padel", detail: "Une heure de terrain offerte par trimestre", organizationId: null },
  ];

  /* ---------------- organisations (partenaires et pros) ---------------- */
  const org = (o: Partial<Organization> & Pick<Organization, "id" | "slug" | "name" | "kinds" | "category">): Organization => ({
    description: null, address: null, area: null, lat: null, lng: null, contactName: null, phone: null, email: null, website: null, instagram: null,
    status: "active", placeId: null, createdAt: iso("2026-05-20"), ...o,
  });
  const organizations: Organization[] = [
    org({ id: "org-bloom", slug: "bloom-house", name: "Bloom House", kinds: ["partner"], category: "Bien-être et ateliers", description: "Conférences, ateliers et soins dans une maison calme de Guéliz.", address: "14 rue de la Liberté", area: "Guéliz", lat: 31.6347, lng: -8.0102, contactName: "Kenza Lahlou", phone: "+212 6 61 20 33 14", email: "bonjour@bloomhouse.example", instagram: "@bloomhouse.marrakech", placeId: "pl-bloom", createdAt: iso("2026-02-03") }),
    org({ id: "org-amaj", slug: "maison-amaj", name: "Maison Amaj", kinds: ["partner"], category: "Pâtisserie et petit-déjeuner", description: "La pâtisserie de Mounir El Fahsi, vainqueur du Meilleur Pâtissier.", address: "Rue Mohammed el Beqal", area: "Guéliz", lat: 31.6392, lng: -8.0127, contactName: "Rim Amajjar", phone: "+212 5 24 43 87 12", email: "contact@maisonamaj.example", instagram: "@maisonamaj", placeId: "pl-amaj", createdAt: iso("2026-05-20") }),
    org({ id: "org-cherkaoui", slug: "cabinet-cherkaoui", name: "Cabinet Loubna Cherkaoui", kinds: ["pro"], category: "Santé · ostéopathie", description: "Ostéopathie adulte, femme enceinte et nourrisson. Consultations en français, arabe et anglais.", address: "Résidence Les Jardins, avenue Hassan II", area: "Guéliz", lat: 31.6321, lng: -8.0049, contactName: "Loubna Cherkaoui", phone: "+212 6 62 18 40 55", email: "cabinet@cherkaoui.example", createdAt: iso("2026-09-01") }),
  ];
  const organizationMembers: OrganizationMember[] = [
    { organizationId: "org-bloom", profileId: "p-g11", role: "owner", createdAt: iso("2026-02-03") },
    { organizationId: "org-amaj", profileId: "p-rim", role: "owner", createdAt: iso("2026-05-20") },
    { organizationId: "org-cherkaoui", profileId: "p-g34", role: "owner", createdAt: iso("2026-09-01") },
  ];

  /* ---------------- journal des opérations ---------------- */
  const auditLog: AuditEntry[] = [
    { id: "al-1", actorId: "p-julia", action: "role.grant", targetType: "profile", targetId: "p-g11", summary: "Rôle Partenaire donné à Kenza Lahlou", details: { role: "partner" }, createdAt: iso("2026-02-03", "11:20") },
    { id: "al-2", actorId: "p-nora", action: "role.grant", targetType: "profile", targetId: "p-rim", summary: "Rôle Partenaire donné à Rim Amajjar", details: { role: "partner" }, createdAt: iso("2026-05-20", "16:05") },
    { id: "al-3", actorId: "p-julia", action: "role.grant", targetType: "profile", targetId: "p-g34", summary: "Rôle Professionnelle donné à Loubna Cherkaoui", details: { role: "pro" }, createdAt: iso("2026-09-01", "09:40") },
    { id: "al-4", actorId: "p-nora", action: "role.grant", targetType: "profile", targetId: "p-yasmine", summary: "Rôle Modératrice donné à Yasmine Tazi", details: { role: "moderator" }, createdAt: iso("2026-09-12", "18:15") },
    { id: "al-5", actorId: "p-julia", action: "event.publish", targetType: "event", targetId: "ev-diner", summary: "« Dîner privé » publié", details: {}, createdAt: iso("2026-09-26", "10:30") },
    { id: "al-6", actorId: "p-julia", action: "reminder.send", targetType: "reminder", targetId: "rem-4", summary: "Relance envoyée · Emma Schneider", details: { reason: "expired" }, createdAt: iso("2026-09-21", "10:00") },
    { id: "al-7", actorId: "p-nora", action: "reminder.send", targetType: "reminder", targetId: "rem-3", summary: "Relance envoyée · Leïla Benjelloun", details: { reason: "expired" }, createdAt: iso("2026-10-01", "10:00") },
  ];

  /* ---------------- notifications ---------------- */
  const notifications: AppNotification[] = [
    { id: "nt-1", recipientId: "p-ines", type: "booking_confirmed", title: "Ta place est réservée", body: "Lunch Raffiné & Networking, lundi 26 octobre au Fer7. Ton billet : NC-2610-0427.", link: "/espace/agenda/lunch-raffine-networking", readAt: iso("2026-10-08", "12:00"), createdAt: iso("2026-10-08", "11:58") },
    { id: "nt-2", recipientId: "p-ines", type: "event_published", title: "Nouveau rendez-vous : Dîner privé", body: "Une grande table dans le jardin de Terrajana. Les places partent vite.", link: "/espace/agenda/diner-prive-terrajana", readAt: null, createdAt: iso("2026-09-26", "10:31") },
    { id: "nt-3", recipientId: "p-julia", type: "event_published", title: "Nouveau rendez-vous : Dîner privé", body: "Publié et visible par toutes les membres.", link: "/fondatrices/evenements", readAt: null, createdAt: iso("2026-09-26", "10:31") },
    { id: "nt-4", recipientId: "p-g11", type: "role_changed", title: "Bienvenue dans l’espace Partenaire", body: "Bloom House est reliée à ton compte. Les offres et statistiques arrivent bientôt.", link: "/partenaire", readAt: null, createdAt: iso("2026-02-03", "11:21") },
    { id: "nt-5", recipientId: "p-g34", type: "role_changed", title: "Ta fiche pro est ouverte", body: "Le Cabinet Loubna Cherkaoui est relié à ton compte professionnel.", link: "/pro", readAt: null, createdAt: iso("2026-09-01", "09:41") },
  ];
  // Préférences : par défaut tout est actif ; Inès a coupé les e-mails des nouveaux rendez-vous.
  const notificationPrefs: NotificationPref[] = [{ profileId: "p-ines", type: "event_published", inApp: true, email: false, push: false }];

  // --- Lot 1 --- : les messages (groupes, modération) et notifications du module rejoignent les tables communes.
  const communaute = createCommunauteSeed(profiles);
  messages.push(...communaute.messages);
  notifications.push(...communaute.notifications);

  return {
    profiles, places, events, bookings, payments, memberships, memories, messages, reminders, partnerOffers,
    organizations, organizationMembers, auditLog, notifications, notificationPrefs,
    // --- Lot 3 --- (complète aussi organisations, rattachements et rôles ci-dessus)
    partenaires: partenairesSeed({ profiles, organizations, organizationMembers, partnerOffers }),
    engagement: createEngagementSeed(), // --- Lot 4 ---
    communaute, // --- Lot 1 ---
  };
}
