/**
 * Données d'exemple du CRM (Lot 5), cohérentes avec src/lib/seed.ts (date de référence : 14 octobre 2026).
 * Chaque profil de l'appli reçoit sa fiche (synchronisation) ; on y ajoute des contacts sans compte
 * (prospects, presse, établissements, anciennes membres), un pipeline rempli, des échanges, des tâches
 * et des segments. N'importe que des types : utilisé par la démo et par `npm run seed:sql`.
 */
import type { Organization, Profile } from "../../types.ts";
import { profileContact } from "./sync.ts";
import type { Activity, ActivityType, Contact, ContactSource, ContactStatus, CrmData, Deal, Segment, Stage, Task } from "./types.ts";

export const CRM_STAGE_IDS = {
  new: "00000000-0000-4000-a000-0000000c5001",
  talk: "00000000-0000-4000-a000-0000000c5002",
  invited: "00000000-0000-4000-a000-0000000c5003",
  proposal: "00000000-0000-4000-a000-0000000c5004",
  won: "00000000-0000-4000-a000-0000000c5005",
  lost: "00000000-0000-4000-a000-0000000c5006",
} as const;

/** Étapes par défaut (les mêmes que 0007_crm.sql). */
export function defaultStages(): Stage[] {
  return [
    { id: CRM_STAGE_IDS.new, label: "Nouveau contact", position: 0, outcome: "open" },
    { id: CRM_STAGE_IDS.talk, label: "Échange", position: 1, outcome: "open" },
    { id: CRM_STAGE_IDS.invited, label: "Invitée à un événement", position: 2, outcome: "open" },
    { id: CRM_STAGE_IDS.proposal, label: "Proposition envoyée", position: 3, outcome: "open" },
    { id: CRM_STAGE_IDS.won, label: "Adhérente", position: 4, outcome: "won" },
    { id: CRM_STAGE_IDS.lost, label: "Perdu", position: 5, outcome: "lost" },
  ];
}

const iso = (ymd: string, hm = "10:00") => new Date(`${ymd}T${hm}:00+01:00`).toISOString();

const JULIA = "p-julia";
const NORA = "p-nora";

type Ext = {
  id: string;
  first: string;
  last: string;
  company?: string;
  job?: string;
  email?: string;
  phone?: string;
  instagram?: string;
  city?: string;
  source: ContactSource;
  status: ContactStatus;
  tags?: string[];
  notes?: string;
  consent?: boolean;
  owner: string | null;
  created: string;
  kind?: "person" | "organization";
  org?: string;
};

/** Contacts sans compte dans l'appli. */
const EXTERNAL: Ext[] = [
  // prospects
  { id: "crm-x01", first: "Mélanie", last: "Vasseur", job: "Fondatrice d’une agence événementielle", email: "melanie.vasseur@exemple.com", phone: "+212 6 61 20 33 41", instagram: "@melanie.events", city: "Marrakech", source: "instagram", status: "prospect", tags: ["entrepreneure", "evenementiel"], consent: true, owner: JULIA, created: "2026-09-02", notes: "A découvert le club par le reel du lancement de saison." },
  { id: "crm-x02", first: "Ghizlane", last: "Ouahbi", job: "Avocate", email: "g.ouahbi@exemple.com", phone: "+212 6 62 48 19 77", city: "Marrakech", source: "bouche_a_oreille", status: "prospect", tags: ["juridique"], consent: true, owner: NORA, created: "2026-08-21", notes: "Recommandée par Yasmine Tazi." },
  { id: "crm-x03", first: "Elodie", last: "Marchetti", job: "Coach sportive", email: "elodie.coach@exemple.com", phone: "+212 6 70 11 52 08", instagram: "@elodie.move", city: "Marrakech", source: "evenement", status: "prospect", tags: ["bien-etre"], consent: true, owner: JULIA, created: "2026-09-24", notes: "Venue au lancement de saison à La Terraza avec une amie." },
  { id: "crm-x04", first: "Rachida", last: "Bensouda", job: "Directrice financière", email: "rachida.b@exemple.com", phone: "+212 6 61 75 40 92", city: "Casablanca", source: "linkedin", status: "prospect", tags: ["finance", "premium-potentiel"], consent: false, owner: NORA, created: "2026-07-14", notes: "S’installe à Marrakech en janvier." },
  { id: "crm-x05", first: "Pauline", last: "Delorme", job: "Créatrice de contenu", email: "pauline@exemple.com", instagram: "@pauline.marrakech", city: "Marrakech", source: "instagram", status: "prospect", tags: ["communication"], consent: true, owner: JULIA, created: "2026-10-05" },
  { id: "crm-x06", first: "Samira", last: "El Fassi", job: "Fondatrice d’une marque de caftans", email: "samira.elfassi@exemple.com", phone: "+212 6 63 02 87 14", city: "Marrakech", source: "parrainage", status: "prospect", tags: ["mode", "entrepreneure"], consent: true, owner: NORA, created: "2026-09-12", notes: "Parrainée par Karima Bennani." },
  { id: "crm-x07", first: "Hélène", last: "Brunet", job: "Consultante en recrutement", email: "helene.brunet@exemple.com", phone: "+33 6 12 45 78 90", city: "Paris puis Marrakech", source: "site", status: "prospect", tags: ["rh"], consent: true, owner: JULIA, created: "2026-09-30", notes: "Demande d’informations via le site : arrivée prévue en novembre." },
  { id: "crm-x08", first: "Nisrine", last: "Alaoui", job: "Pharmacienne", email: "nisrine.alaoui@exemple.com", phone: "+212 6 64 33 10 58", city: "Marrakech", source: "evenement", status: "prospect", tags: ["sante"], consent: true, owner: NORA, created: "2026-08-04", notes: "Petit-déjeuner mixte chez Maison Amaj." },
  { id: "crm-x09", first: "Vanessa", last: "Kleber", job: "Architecte paysagiste", email: "vanessa.kleber@exemple.com", city: "Marrakech", source: "bouche_a_oreille", status: "prospect", tags: ["architecture"], consent: false, owner: JULIA, created: "2026-06-18" },
  { id: "crm-x10", first: "Oumaima", last: "Raji", job: "Développeuse freelance", email: "oumaima.raji@exemple.com", phone: "+212 6 65 90 21 37", instagram: "@ouma.codes", city: "Marrakech", source: "instagram", status: "prospect", tags: ["tech"], consent: true, owner: NORA, created: "2026-10-09" },
  { id: "crm-x11", first: "Charlotte", last: "Weiss", job: "Professeure de piano", email: "charlotte.weiss@exemple.com", city: "Marrakech", source: "evenement", status: "prospect", tags: ["culture"], consent: true, owner: JULIA, created: "2026-05-04", notes: "Dîner d’exception à Terrajana, invitée par Anaïs." },
  { id: "crm-x12", first: "Safae", last: "Mouline", job: "Responsable communication d’un riad", email: "safae.mouline@exemple.com", phone: "+212 6 66 14 72 30", city: "Marrakech", source: "parrainage", status: "prospect", tags: ["hotellerie", "communication"], consent: true, owner: NORA, created: "2026-09-19" },
  { id: "crm-x13", first: "Laure", last: "Fabre", job: "Psychologue", email: "laure.fabre@exemple.com", city: "Essaouira", source: "site", status: "prospect", tags: ["sante"], consent: false, owner: null, created: "2026-10-12", notes: "Formulaire du site : vit à Essaouira, vient souvent à Marrakech." },
  { id: "crm-x14", first: "Asmaa", last: "Tounsi", job: "Fondatrice d’une crèche bilingue", email: "asmaa.tounsi@exemple.com", phone: "+212 6 67 55 08 63", city: "Marrakech", source: "bouche_a_oreille", status: "prospect", tags: ["famille", "entrepreneure"], consent: true, owner: JULIA, created: "2026-07-28" },
  { id: "crm-x15", first: "Inès", last: "Laurent", job: "Consultante en communication", email: "ines@exemple.com", city: "Marrakech", source: "instagram", status: "prospect", tags: ["doublon"], consent: false, owner: null, created: "2025-10-30", notes: "Fiche créée à la main avant son adhésion (doublon de son compte)." },
  // anciennes membres sans compte (avant l'appli)
  { id: "crm-x16", first: "Sonia", last: "Amrani", job: "Styliste", email: "sonia.amrani@exemple.com", phone: "+212 6 68 41 90 25", city: "Marrakech", source: "bouche_a_oreille", status: "ancienne", tags: ["membre-2025", "mode"], consent: true, owner: NORA, created: "2024-11-10", notes: "Membre 2024-2025, n’a pas renouvelé (voyages fréquents)." },
  { id: "crm-x17", first: "Delphine", last: "Rey", job: "Chargée de projets culturels", email: "delphine.rey@exemple.com", city: "Rabat", source: "evenement", status: "ancienne", tags: ["membre-2025", "culture"], consent: true, owner: JULIA, created: "2024-09-15", notes: "Partie s’installer à Rabat en juin 2025." },
  { id: "crm-x18", first: "Kawtar", last: "Benali", job: "Fleuriste", email: "kawtar.fleurs@exemple.com", phone: "+212 6 69 27 64 81", city: "Marrakech", source: "instagram", status: "ancienne", tags: ["membre-2025"], consent: true, owner: NORA, created: "2025-01-20" },
  { id: "crm-x19", first: "Agnès", last: "Morin", job: "Retraitée, ancienne DRH", email: "agnes.morin@exemple.com", city: "Marrakech", source: "bouche_a_oreille", status: "ancienne", tags: ["membre-2024"], consent: false, owner: null, created: "2023-10-02" },
  // presse
  { id: "crm-x20", first: "Leïla", last: "Chaoui", company: "Femmes du Maroc", job: "Journaliste", email: "l.chaoui@exemple.com", phone: "+212 5 22 00 11 22", city: "Casablanca", source: "presse", status: "presse", tags: ["magazine"], consent: true, owner: NORA, created: "2026-03-20", notes: "Article sur l’iftar du club en mars." },
  { id: "crm-x21", first: "Thomas", last: "Gaillard", company: "Le Petit Journal Marrakech", job: "Rédacteur en chef", email: "redaction@exemple.com", city: "Marrakech", source: "presse", status: "presse", tags: ["web"], consent: true, owner: JULIA, created: "2026-09-25" },
  { id: "crm-x22", first: "Yousra", last: "Amine", company: "Radio Atlas", job: "Animatrice", email: "yousra.amine@exemple.com", city: "Marrakech", source: "presse", status: "presse", tags: ["radio"], consent: false, owner: NORA, created: "2026-06-02" },
  // établissements et partenaires potentiels
  { id: "crm-x23", first: "Karim", last: "Haddaoui", company: "Riad Dar Zelij", job: "Directeur", email: "contact@darzelij.exemple.com", phone: "+212 5 24 38 00 00", city: "Médina", source: "partenaire", status: "partenaire", tags: ["hotellerie", "lieu-evenement"], consent: true, owner: NORA, created: "2026-08-30", kind: "organization", notes: "Prêt à accueillir un dîner de 25 personnes en décembre." },
  { id: "crm-x24", first: "Aïcha", last: "Bennis", company: "Spa Les Jardins", job: "Gérante", email: "spa.jardins@exemple.com", phone: "+212 5 24 42 11 90", city: "Hivernage", source: "partenaire", status: "partenaire", tags: ["bien-etre", "offre-membre"], consent: true, owner: JULIA, created: "2026-09-08", kind: "organization", notes: "Propose -20 % aux membres, contrat à préparer." },
  { id: "crm-x25", first: "Nicolas", last: "Ferrand", company: "Studio Ferrand", job: "Photographe", email: "studio.ferrand@exemple.com", city: "Guéliz", source: "partenaire", status: "pro", tags: ["photographie", "carnet"], consent: true, owner: JULIA, created: "2026-07-01", kind: "organization", notes: "Intéressé par une fiche dans le carnet pro." },
  { id: "crm-x26", first: "Houda", last: "Lahbabi", company: "Cabinet Lahbabi", job: "Expert-comptable", email: "cabinet.lahbabi@exemple.com", phone: "+212 5 24 43 56 78", city: "Guéliz", source: "bouche_a_oreille", status: "pro", tags: ["comptabilite", "carnet"], consent: true, owner: NORA, created: "2026-05-15", kind: "organization" },
  { id: "crm-x27", first: "Sébastien", last: "Morel", company: "Atlas Coworking", job: "Responsable partenariats", email: "partenariats@atlascowork.exemple.com", city: "Guéliz", source: "linkedin", status: "partenaire", tags: ["coworking", "lieu-evenement"], consent: true, owner: JULIA, created: "2026-10-01", kind: "organization" },
  { id: "crm-x28", first: "Malika", last: "Squalli", company: "Fondation Tamkine", job: "Chargée de mécénat", email: "malika.squalli@exemple.com", city: "Marrakech", source: "autre", status: "autre", tags: ["mecenat"], consent: false, owner: NORA, created: "2026-04-11" },
];

/** Enrichissement des fiches des comptes (source, responsable, étiquettes, consentement). */
const PROFILE_EXTRA: Record<string, Partial<Pick<Contact, "source" | "tags" | "notes" | "marketingConsent" | "ownerId" | "city" | "instagram">>> = {
  "p-ines": { source: "instagram", tags: ["communication", "ambassadrice"], ownerId: JULIA, marketingConsent: true, notes: "Très active au salon, propose d’animer un atelier communication." },
  "p-yasmine": { source: "bouche_a_oreille", tags: ["juridique", "moderatrice"], ownerId: NORA, marketingConsent: true },
  "p-salma": { source: "evenement", tags: ["architecture", "premium"], ownerId: JULIA, marketingConsent: true, notes: "Renouvellement Premium fin octobre : l’appeler avant." },
  "p-maya": { source: "instagram", tags: ["premium", "creatif"], ownerId: NORA, marketingConsent: true },
  "p-chloe": { source: "parrainage", tags: ["photographie"], ownerId: JULIA, marketingConsent: true },
  "p-nadia": { source: "site", tags: ["cosmetique", "entrepreneure"], ownerId: NORA, marketingConsent: true },
  "p-lou": { source: "evenement", tags: ["famille"], ownerId: JULIA, marketingConsent: true, notes: "Virement de renouvellement déclaré le 11 octobre." },
  "p-leila": { source: "bouche_a_oreille", tags: ["bien-etre"], ownerId: NORA, marketingConsent: true, notes: "Hésite à renouveler : moins disponible cette année." },
  "p-emma": { source: "site", tags: ["traduction"], ownerId: JULIA, marketingConsent: false, notes: "Relancée deux fois, pas de réponse." },
  "p-capucine": { source: "instagram", tags: ["decoration"], ownerId: JULIA, marketingConsent: true },
  "p-nawal": { source: "linkedin", tags: ["tech"], ownerId: NORA, marketingConsent: true },
  "p-justine": { source: "parrainage", tags: ["sante"], ownerId: JULIA, marketingConsent: true },
  "p-sophie": { source: "linkedin", tags: ["rh"], ownerId: NORA, marketingConsent: true },
  "p-karima": { source: "bouche_a_oreille", tags: ["entrepreneure", "ambassadrice"], ownerId: NORA, marketingConsent: true },
  "p-anais": { source: "evenement", tags: ["hotellerie", "premium", "lieu-evenement"], ownerId: JULIA, marketingConsent: true },
  "p-aurelie": { source: "site", tags: ["tech"], ownerId: NORA, marketingConsent: false },
  "p-ambre": { source: "instagram", tags: ["nouvelle"], ownerId: JULIA, marketingConsent: true, notes: "Adhésion le 2 octobre après le lancement de saison." },
  "p-hana": { source: "evenement", tags: ["tech"], ownerId: NORA, marketingConsent: true, notes: "Compte gratuit, déjà venue à deux rendez-vous." },
  "p-clara": { source: "instagram", tags: ["creatif"], ownerId: JULIA, marketingConsent: true },
  "p-sarah": { source: "site", tags: ["communication"], ownerId: NORA, marketingConsent: false },
  "p-rim": { source: "partenaire", tags: ["partenaire", "patisserie"], ownerId: NORA, marketingConsent: true },
  "p-g11": { source: "partenaire", tags: ["partenaire", "bien-etre"], ownerId: NORA, marketingConsent: true },
  "p-g34": { source: "bouche_a_oreille", tags: ["carnet", "sante"], ownerId: JULIA, marketingConsent: true },
};

const SOURCES_CYCLE: ContactSource[] = ["bouche_a_oreille", "instagram", "evenement", "parrainage", "site", "instagram", "bouche_a_oreille", "linkedin"];

type DealSeed = [id: string, contact: string, stage: keyof typeof CRM_STAGE_IDS, title: string, value: number, created: string, closed: string | null, lostReason?: string];

const DEALS: DealSeed[] = [
  ["crm-d01", "crm-x01", "proposal", "Adhésion Membre", 670, "2026-09-03", null],
  ["crm-d02", "crm-x02", "talk", "Adhésion Membre", 670, "2026-08-22", null],
  ["crm-d03", "crm-x03", "invited", "Adhésion Membre", 670, "2026-09-25", null],
  ["crm-d04", "crm-x04", "talk", "Adhésion Premium", 1250, "2026-07-15", null],
  ["crm-d05", "crm-x05", "new", "Adhésion Membre", 670, "2026-10-05", null],
  ["crm-d06", "crm-x06", "proposal", "Adhésion Membre", 670, "2026-09-13", null],
  ["crm-d07", "crm-x07", "new", "Adhésion Membre", 670, "2026-09-30", null],
  ["crm-d08", "crm-x08", "invited", "Adhésion Membre", 670, "2026-08-05", null],
  ["crm-d09", "crm-x09", "lost", "Adhésion Membre", 670, "2026-06-19", "2026-08-10", "Pas le bon moment"],
  ["crm-d10", "crm-x10", "new", "Adhésion Membre", 670, "2026-10-09", null],
  ["crm-d11", "crm-x11", "lost", "Adhésion Membre", 670, "2026-05-05", "2026-06-30", "Budget"],
  ["crm-d12", "crm-x12", "talk", "Adhésion Premium", 1250, "2026-09-20", null],
  ["crm-d13", "crm-x13", "new", "Adhésion Membre", 670, "2026-10-12", null],
  ["crm-d14", "crm-x14", "proposal", "Adhésion Premium", 1250, "2026-07-29", null],
  ["crm-d15", "crm-p-hana", "invited", "Adhésion Membre", 670, "2026-06-20", null],
  ["crm-d16", "crm-p-clara", "talk", "Adhésion Membre", 670, "2026-09-09", null],
  ["crm-d17", "crm-p-sarah", "new", "Adhésion Membre", 670, "2026-09-25", null],
  ["crm-d18", "crm-p-ambre", "won", "Adhésion Membre", 670, "2026-09-24", "2026-10-02"],
  ["crm-d19", "crm-p-capucine", "won", "Adhésion Membre", 670, "2025-12-10", "2026-01-14"],
  ["crm-d20", "crm-x18", "lost", "Renouvellement", 670, "2026-01-05", "2026-02-01", "Quitte Marrakech une partie de l’année"],
  ["crm-d21", "crm-x16", "proposal", "Retour au club", 670, "2026-09-15", null],
  ["crm-d22", "crm-x24", "talk", "Partenariat offre membres", 0, "2026-09-08", null],
  ["crm-d23", "crm-x25", "proposal", "Fiche carnet pro", 360, "2026-07-02", null],
  ["crm-d24", "crm-x26", "won", "Fiche carnet pro", 360, "2026-05-16", "2026-06-05"],
  ["crm-d25", "crm-x22", "lost", "Partenariat média", 0, "2026-06-03", "2026-07-20", "Préfère un autre réseau"],
  ["crm-d26", "crm-p-g10", "won", "Adhésion Membre", 670, "2025-12-01", "2026-01-08"],
  ["crm-d27", "crm-p-g20", "won", "Adhésion Premium", 1250, "2026-02-20", "2026-03-12"],
  ["crm-d28", "crm-x17", "lost", "Renouvellement", 670, "2025-05-10", "2025-06-15", "Quitte Marrakech"],
  ["crm-d29", "crm-x23", "invited", "Lieu du dîner de décembre", 0, "2026-08-31", null],
  ["crm-d30", "crm-p-g05", "won", "Adhésion Premium", 1250, "2026-08-01", "2026-08-21"],
];

type ActSeed = [contact: string, type: ActivityType, body: string, day: string, hm: string, author: string];

const ACTIVITIES: ActSeed[] = [
  ["crm-x01", "whatsapp", "Premier message après son commentaire sur Instagram. Très intéressée par les lunchs.", "2026-09-02", "11:20", JULIA],
  ["crm-x01", "call", "Appel de 20 min : agence de 6 personnes, cherche du réseau côté hôtels. Je lui envoie la plaquette.", "2026-09-06", "16:00", JULIA],
  ["crm-x01", "email", "Proposition d’adhésion Membre envoyée avec le calendrier d’automne.", "2026-09-29", "09:45", JULIA],
  ["crm-x02", "meeting", "Café au Grand Café de la Poste avec Yasmine. Veut voir un lunch avant de se décider.", "2026-08-28", "10:30", NORA],
  ["crm-x03", "event", "Lancement de la saison à La Terraza.", "2026-09-24", "19:00", JULIA],
  ["crm-x03", "whatsapp", "Invitée au lunch du Fer7 du 26 octobre (tarif public).", "2026-10-01", "12:10", JULIA],
  ["crm-x04", "call", "Visio : arrive en janvier, veut connaître les femmes du secteur finance. Formule Premium envisagée.", "2026-07-20", "18:00", NORA],
  ["crm-x04", "email", "Envoi de la liste des rendez-vous de janvier.", "2026-09-15", "09:00", NORA],
  ["crm-x05", "note", "A écrit en message privé sur Instagram : demande les tarifs.", "2026-10-05", "21:10", JULIA],
  ["crm-x06", "meeting", "Rendez-vous à son atelier avec Karima. Très enthousiaste.", "2026-09-17", "15:00", NORA],
  ["crm-x06", "email", "Proposition envoyée (adhésion Membre, paiement en virement).", "2026-09-22", "10:20", NORA],
  ["crm-x07", "email", "Réponse au formulaire du site : présentation du club et des formules.", "2026-10-01", "09:30", JULIA],
  ["crm-x08", "event", "Petit-déjeuner, édition mixte, chez Maison Amaj.", "2026-08-04", "09:00", NORA],
  ["crm-x08", "whatsapp", "Invitée au tournoi de padel du 7 novembre.", "2026-10-06", "17:40", NORA],
  ["crm-x09", "call", "Pas disponible cette année (chantier en cours). Recontacter au printemps.", "2026-08-10", "11:00", JULIA],
  ["crm-x10", "note", "Contact reçu via le reel « Une journée au club ».", "2026-10-09", "20:30", NORA],
  ["crm-x11", "event", "Dîner d’exception à Terrajana, invitée par Anaïs Roux.", "2026-05-04", "20:00", JULIA],
  ["crm-x11", "call", "Trouve l’adhésion trop chère pour l’instant.", "2026-06-30", "14:00", JULIA],
  ["crm-x12", "whatsapp", "Présentée par Anaïs. Veut un rendez-vous pour parler partenariat et adhésion.", "2026-09-20", "13:15", NORA],
  ["crm-x14", "meeting", "Visite de la crèche. Intéressée par Premium pour le Family Day.", "2026-08-05", "10:00", JULIA],
  ["crm-x14", "email", "Proposition Premium envoyée.", "2026-09-10", "09:00", JULIA],
  ["crm-x16", "call", "Revient s’installer à Marrakech : réfléchit à reprendre une adhésion.", "2026-09-15", "18:30", NORA],
  ["crm-x18", "whatsapp", "Ne renouvelle pas, voyage six mois par an.", "2026-02-01", "10:00", NORA],
  ["crm-x20", "email", "Envoi des photos de l’iftar pour l’article.", "2026-03-22", "11:00", NORA],
  ["crm-x21", "email", "Proposition d’un portrait de Julia et Nora pour la rentrée.", "2026-09-26", "15:20", JULIA],
  ["crm-x23", "meeting", "Visite du riad : salle de 25 couverts, terrasse. Devis demandé.", "2026-09-04", "11:00", NORA],
  ["crm-x24", "call", "D’accord pour -20 % aux membres. Contrat partenaire à prévoir (module contrats).", "2026-09-10", "12:00", JULIA],
  ["crm-x25", "email", "Envoi des conditions du carnet pro (abonnement mensuel).", "2026-07-08", "10:00", JULIA],
  ["crm-x26", "call", "Fiche carnet validée, abonnement démarré.", "2026-06-05", "09:30", NORA],
  ["crm-x27", "email", "Premier contact pour accueillir un atelier du club.", "2026-10-02", "16:45", JULIA],
  ["crm-p-ines", "whatsapp", "Propose d’animer un atelier « parler de son activité » en novembre.", "2026-10-03", "10:15", JULIA],
  ["crm-p-ines", "event", "Lunch Raffiné & Networking (réservé).", "2026-10-08", "12:00", JULIA],
  ["crm-p-salma", "call", "Renouvellement Premium : ok sur le principe, attend son virement de fin de mois.", "2026-10-10", "11:30", JULIA],
  ["crm-p-leila", "whatsapp", "Relance pour le renouvellement : « je reviens vers vous après les vacances ».", "2026-10-01", "10:00", NORA],
  ["crm-p-emma", "email", "Deuxième relance de renouvellement, sans réponse.", "2026-09-21", "10:00", JULIA],
  ["crm-p-lou", "note", "Virement de renouvellement déclaré, à valider dans Encaissements.", "2026-10-11", "18:00", JULIA],
  ["crm-p-hana", "event", "Lancement de la saison à La Terraza.", "2026-09-24", "19:00", NORA],
  ["crm-p-hana", "whatsapp", "Invitée au lunch du Fer7 avec le tarif membre si elle adhère avant.", "2026-10-02", "09:20", NORA],
  ["crm-p-clara", "call", "Graphiste freelance : intéressée, attend une grosse facture pour adhérer.", "2026-09-15", "17:00", JULIA],
  ["crm-p-sarah", "note", "Compte créé depuis la page Formules.", "2026-09-24", "22:00", NORA],
  ["crm-p-ambre", "meeting", "Rencontrée au lancement de saison, adhère dans la semaine.", "2026-09-24", "20:30", JULIA],
  ["crm-p-ambre", "system", "Adhésion Membre payée par carte.", "2026-10-02", "14:00", JULIA],
  ["crm-p-anais", "meeting", "Point partenariat : son hôtel peut accueillir le dîner de printemps.", "2026-09-18", "12:30", JULIA],
  ["crm-p-karima", "whatsapp", "Remerciée pour le parrainage de Samira El Fassi.", "2026-09-13", "10:40", NORA],
  ["crm-p-g11", "meeting", "Point Bloom House : statistiques des offres à venir dans l’espace partenaire.", "2026-09-29", "15:00", NORA],
  ["crm-p-rim", "call", "Maison Amaj partante pour un petit-déjeuner par trimestre.", "2026-09-05", "10:00", NORA],
  ["crm-p-g34", "email", "Fiche carnet pro du cabinet mise en ligne.", "2026-09-01", "09:45", JULIA],
  ["crm-p-yasmine", "note", "Accepte d’être modératrice du salon.", "2026-09-12", "18:20", NORA],
  ["crm-p-chloe", "whatsapp", "Renouvellement à venir (19 octobre) : rappel envoyé.", "2026-10-07", "09:30", JULIA],
];

type TaskSeed = [id: string, contact: string | null, title: string, due: string, owner: string, done: string | null];

const TASKS: TaskSeed[] = [
  ["crm-t01", "crm-x01", "Relancer Mélanie sur la proposition d’adhésion", "2026-10-13", JULIA, null],
  ["crm-t02", "crm-x02", "Inviter Ghizlane au lunch du Fer7", "2026-10-14", NORA, null],
  ["crm-t03", "crm-p-salma", "Appeler Salma pour le renouvellement Premium", "2026-10-14", JULIA, null],
  ["crm-t04", "crm-x06", "Envoyer le RIB à Samira", "2026-10-14", NORA, null],
  ["crm-t05", "crm-x04", "Préparer la sélection de rendez-vous de janvier pour Rachida", "2026-10-20", NORA, null],
  ["crm-t06", "crm-x14", "Relancer Asmaa (proposition Premium)", "2026-10-09", JULIA, null],
  ["crm-t07", "crm-p-leila", "Rappeler Leïla pour son renouvellement", "2026-10-15", NORA, null],
  ["crm-t08", "crm-p-hana", "Confirmer la place d’Hana au lunch", "2026-10-16", NORA, null],
  ["crm-t09", "crm-x23", "Relancer le devis du Riad Dar Zelij", "2026-10-10", NORA, null],
  ["crm-t10", "crm-x24", "Préparer le contrat partenaire du Spa Les Jardins", "2026-10-21", JULIA, null],
  ["crm-t11", "crm-x21", "Répondre au Petit Journal pour le portrait", "2026-10-15", JULIA, null],
  ["crm-t12", "crm-p-ines", "Caler la date de l’atelier d’Inès", "2026-10-22", JULIA, null],
  ["crm-t13", "crm-x07", "Appeler Hélène à son arrivée", "2026-11-05", JULIA, null],
  ["crm-t14", "crm-x16", "Envoyer à Sonia l’offre de retour", "2026-10-17", NORA, null],
  ["crm-t15", "crm-p-clara", "Prendre des nouvelles de Clara", "2026-10-28", JULIA, null],
  ["crm-t16", null, "Mettre à jour la plaquette 2027", "2026-10-30", NORA, null],
  ["crm-t17", "crm-x03", "Envoyer le lien de réservation du Fer7 à Elodie", "2026-10-02", JULIA, "2026-10-01"],
  ["crm-t18", "crm-p-ambre", "Envoyer le kit de bienvenue à Ambre", "2026-10-03", JULIA, "2026-10-03"],
  ["crm-t19", "crm-x12", "Proposer un rendez-vous à Safae", "2026-09-25", NORA, "2026-09-24"],
  ["crm-t20", "crm-p-emma", "Dernière relance Emma", "2026-10-12", JULIA, null],
  ["crm-t21", "crm-x27", "Visiter Atlas Coworking", "2026-10-19", JULIA, null],
  ["crm-t22", "crm-x10", "Répondre à Oumaima (tarifs)", "2026-10-11", NORA, null],
];

export function createCrmSeed(base: { profiles: Profile[]; organizations: Organization[] }): CrmData {
  const orgByName = new Map(base.organizations.map((o) => [o.name, o.id]));
  const linkedOrg: Record<string, string> = { "p-g11": "Bloom House", "p-rim": "Maison Amaj" };

  const profileContacts: Contact[] = base.profiles.map((p, i) => {
    const c = profileContact(p);
    const extra = PROFILE_EXTRA[p.id] ?? {};
    const isAdminProfile = p.roles.includes("admin");
    const consent = extra.marketingConsent ?? i % 4 !== 0;
    return {
      ...c,
      source: isAdminProfile ? "autre" : extra.source ?? SOURCES_CYCLE[i % SOURCES_CYCLE.length],
      tags: extra.tags ?? (p.plan === "premium" ? ["premium"] : []),
      notes: extra.notes ?? "",
      marketingConsent: consent,
      consentAt: consent ? p.createdAt : null,
      ownerId: isAdminProfile ? null : extra.ownerId ?? (i % 2 ? JULIA : NORA),
      organizationId: linkedOrg[p.id] ? orgByName.get(linkedOrg[p.id]) ?? null : null,
      city: extra.city ?? "Marrakech",
      instagram: extra.instagram ?? null,
    };
  });

  const external: Contact[] = EXTERNAL.map((e) => ({
    id: e.id,
    kind: e.kind ?? "person",
    profileId: null,
    organizationId: null,
    firstName: e.first,
    lastName: e.last,
    company: e.company ?? null,
    job: e.job ?? null,
    email: e.email ?? null,
    phone: e.phone ?? null,
    instagram: e.instagram ?? null,
    city: e.city ?? null,
    source: e.source,
    status: e.status,
    tags: e.tags ?? [],
    notes: e.notes ?? "",
    marketingConsent: e.consent ?? false,
    consentAt: e.consent ? iso(e.created) : null,
    ownerId: e.owner,
    createdBy: e.owner,
    createdAt: iso(e.created),
    updatedAt: iso(e.created),
  }));

  const contacts = [...profileContacts, ...external];
  const ids = new Set(contacts.map((c) => c.id));
  const has = (id: string) => ids.has(id);
  const ownerOf = (id: string) => contacts.find((c) => c.id === id)?.ownerId ?? JULIA;

  const positions = new Map<string, number>();
  const deals: Deal[] = DEALS.filter(([, contact]) => has(contact)).map(([id, contactId, stage, title, value, created, closed, lostReason]) => {
    const stageId = CRM_STAGE_IDS[stage];
    const pos = positions.get(stageId) ?? 0;
    positions.set(stageId, pos + 1);
    return {
      id,
      contactId,
      stageId,
      title,
      value,
      lostReason: lostReason ?? null,
      ownerId: ownerOf(contactId),
      position: pos,
      expectedClose: null,
      closedAt: closed ? iso(closed, "18:00") : null,
      createdAt: iso(created),
      updatedAt: iso(closed ?? created, "18:00"),
    };
  });

  const activities: Activity[] = ACTIVITIES.filter(([contact]) => has(contact)).map(([contactId, type, body, day, hm, author], i) => ({
    id: `crm-a${String(i + 1).padStart(2, "0")}`,
    contactId,
    type,
    body,
    occurredAt: iso(day, hm),
    authorId: author,
    createdAt: iso(day, hm),
  }));

  const tasks: Task[] = TASKS.filter(([, contact]) => contact === null || has(contact)).map(([id, contactId, title, due, owner, done]) => ({
    id,
    contactId,
    title,
    dueOn: due,
    ownerId: owner,
    doneAt: done ? iso(done, "17:00") : null,
    remindedAt: due < "2026-10-14" && !done ? iso("2026-10-13", "08:00") : null,
    createdBy: owner,
    createdAt: iso("2026-09-20"),
  }));

  const segments: Segment[] = [
    { id: "crm-s01", name: "Adhésion qui expire dans 30 jours", description: "Adhérentes à relancer pour le renouvellement.", filters: { expiresWithin: 30 }, createdBy: JULIA, createdAt: iso("2026-09-01"), updatedAt: iso("2026-09-01") },
    { id: "crm-s02", name: "Venues à un événement sans adhérer", description: "Prospects et comptes gratuits déjà venus à un rendez-vous.", filters: { eventNoMembership: true }, createdBy: NORA, createdAt: iso("2026-09-01"), updatedAt: iso("2026-09-01") },
    { id: "crm-s03", name: "Anciennes membres 2025", description: "Adhésion terminée en 2025 : leur proposer de revenir.", filters: { lapsedYear: 2025 }, createdBy: NORA, createdAt: iso("2026-09-05"), updatedAt: iso("2026-09-05") },
    { id: "crm-s04", name: "Anciennes membres 2026", description: "Adhésion échue cette année.", filters: { lapsedYear: 2026 }, createdBy: JULIA, createdAt: iso("2026-10-01"), updatedAt: iso("2026-10-01") },
    { id: "crm-s05", name: "Prospects Instagram qui acceptent les messages", description: null, filters: { status: ["prospect"], source: ["instagram"], consent: true }, createdBy: JULIA, createdAt: iso("2026-10-02"), updatedAt: iso("2026-10-02") },
    { id: "crm-s06", name: "Établissements à démarcher", description: "Partenaires et pros potentiels.", filters: { status: ["partenaire", "pro"], hasAccount: false }, createdBy: NORA, createdAt: iso("2026-10-03"), updatedAt: iso("2026-10-03") },
  ];

  return { contacts, stages: defaultStages(), deals, activities, tasks, segments };
}
