/**
 * Lot 1 — Communauté : données d'exemple (actualités, groupes, modération, annuaire).
 * Date de référence : mercredi 14 octobre 2026. Importé par src/lib/seed.ts (une ligne), qui sert aussi
 * à générer supabase/seed.sql : ce fichier n'importe que des types et des fichiers .ts relatifs.
 */
import type { AppNotification, Message, Profile } from "../../types.ts";
import type { ChatGroup, CommunauteData, DirectoryProfile, GroupMember, MessageReport, ModerationKeyword, NewsPost, NewsReaction, ReactionKind } from "./types.ts";

const iso = (ymd: string, time = "10:00") => new Date(`${ymd}T${time}:00+01:00`).toISOString();

/** Secteur déduit du métier (membres générées). */
const SECTOR_OF_JOB: Array<[RegExp, string, string[]]> = [
  [/voyage|mariage|événement/i, "Événementiel et voyage", ["Organisation d’événements", "Réseau de prestataires", "Logistique"]],
  [/avocat|comptable/i, "Droit et finance", ["Droit des sociétés", "Fiscalité", "Création d’entreprise au Maroc"]],
  [/pâtissi|culinaire/i, "Hôtellerie et restauration", ["Pâtisserie", "Food styling", "Événements gourmands"]],
  [/stratégie|marketing|journaliste/i, "Communication et marketing", ["Stratégie de marque", "Réseaux sociaux", "Relations presse"]],
  [/architecte/i, "Architecture et design", ["Rénovation de riads", "Suivi de chantier", "Plans 3D"]],
  [/coach|psycholog/i, "Bien-être et sport", ["Accompagnement individuel", "Ateliers de groupe", "Gestion du stress"]],
  [/textile|bijoux|céramique/i, "Mode, beauté et bijoux", ["Artisanat marocain", "Vente en ligne", "Sourcing"]],
  [/ostéo/i, "Santé", ["Ostéopathie", "Périnatalité", "Posture au travail"]],
  [/professeure|crèche/i, "Éducation et famille", ["Pédagogie", "Ateliers enfants", "Français langue étrangère"]],
  [/ingénieure|développeuse/i, "Tech et digital", ["Développement web", "Automatisation", "Produit"]],
  [/photographe/i, "Art, photo et création", ["Photo de produit", "Portrait", "Retouche"]],
];

export function createCommunauteSeed(profiles: Profile[]): CommunauteData {
  const has = new Set(profiles.map((p) => p.id));

  /* ---------------- annuaire : fiches complètes ---------------- */
  const dir = (o: Partial<DirectoryProfile> & { profileId: string }): DirectoryProfile => ({
    company: null,
    sector: null,
    skills: [],
    instagram: null,
    linkedin: null,
    website: null,
    lookingFor: null,
    offering: null,
    visibility: "all",
    showWhatsapp: false,
    showEmail: false,
    updatedAt: iso("2026-10-01"),
    ...o,
  });
  const named: DirectoryProfile[] = [
    dir({ profileId: "p-julia", company: "Nomad Club", sector: "Événementiel et voyage", skills: ["Animation de communauté", "Événementiel", "Réseau à Marrakech"], instagram: "@marrakechnomadclub", website: "https://nomadclub.example", lookingFor: "Des lieux qui ont une âme pour nos prochains rendez-vous.", offering: "Mon carnet d’adresses et un café pour chaque nouvelle arrivée.", showEmail: true }),
    dir({ profileId: "p-nora", company: "Nomad Club", sector: "Événementiel et voyage", skills: ["Partenariats", "Négociation", "Arabe, français, anglais"], instagram: "@marrakechnomadclub", lookingFor: "Des partenaires bien-être et des intervenantes inspirantes.", offering: "Des présentations : je connais (presque) tout Marrakech.", showEmail: true }),
    dir({ profileId: "p-ines", company: "Laurent Conseil", sector: "Communication et marketing", skills: ["Relations presse", "Stratégie de marque", "Lancement au Maroc"], linkedin: "linkedin.com/in/ines-laurent", lookingFor: "Une graphiste et une photographe pour des clientes hôtelières.", offering: "Un regard sur ta communication et mon réseau presse en France.", showWhatsapp: true }),
    dir({ profileId: "p-yasmine", company: "Cabinet Tazi Avocats", sector: "Droit et finance", skills: ["Droit des affaires", "Création de société", "Baux commerciaux"], linkedin: "linkedin.com/in/yasmine-tazi", lookingFor: "Des intervenantes pour un atelier « entreprendre au Maroc ».", offering: "Une première consultation offerte aux membres pour créer sa société.", showEmail: true }),
    dir({ profileId: "p-salma", company: "Studio Alaoui", sector: "Architecture et design", skills: ["Architecture d’intérieur", "Riads", "Mobilier sur mesure"], instagram: "@studio.alaoui", lookingFor: "Une artisane zellige de confiance pour un chantier à la Médina.", offering: "Des conseils déco et mes adresses d’artisans." }),
    dir({ profileId: "p-maya", company: "Maya B. Studio", sector: "Art, photo et création", skills: ["Direction artistique", "Identité visuelle", "Shooting"], instagram: "@mayab.studio", website: "https://mayab.example", lookingFor: "Des marques marocaines à accompagner.", offering: "Un audit de ton identité visuelle en 30 minutes." }),
    dir({ profileId: "p-chloe", sector: "Art, photo et création", skills: ["Portrait", "Photo culinaire", "Reportage d’événement"], instagram: "@chloe.martin.photo", lookingFor: "Des restaurants pour une série « tables de Marrakech ».", offering: "Un portrait professionnel à tarif membre.", showWhatsapp: true }),
    dir({ profileId: "p-nadia", company: "Argan & Co", sector: "Mode, beauté et bijoux", skills: ["Cosmétique naturelle", "Formulation", "Export Canada"], instagram: "@argan.and.co", lookingFor: "Une distributrice au Canada et en France.", offering: "Des échantillons et mes contacts de coopératives d’argan." }),
    dir({ profileId: "p-lou", sector: "Éducation et famille", skills: ["Parentalité positive", "Ateliers parents-enfants"], lookingFor: "Une salle pour des ateliers le samedi matin.", offering: "Un atelier découverte pour les mamans du club.", visibility: "basic" }),
    dir({ profileId: "p-leila", company: "Studio Souffle", sector: "Bien-être et sport", skills: ["Yoga vinyasa", "Méditation", "Retraites"], instagram: "@studio.souffle", lookingFor: "Un riad pour une retraite de printemps.", offering: "Un cours d’essai offert." }),
    dir({ profileId: "p-emma", sector: "Communication et marketing", skills: ["Traduction allemand-français", "Interprétariat", "Sous-titrage"], lookingFor: "Des clientes dans le tourisme haut de gamme.", offering: "La relecture de tes supports en allemand." }),
    dir({ profileId: "p-capucine", company: "Maison Capucine", sector: "Architecture et design", skills: ["Décoration", "Home staging", "Chine et brocante"], instagram: "@maison.capucine", lookingFor: "Des colocataires pour un stand au salon de la déco.", offering: "Mes adresses de souks pour chiner." }),
    dir({ profileId: "p-nawal", sector: "Tech et digital", skills: ["Gestion de projet", "Agile", "Sites e-commerce"], linkedin: "linkedin.com/in/nawal-garcia", lookingFor: "Une développeuse freelance pour des missions ponctuelles.", offering: "De l’aide pour cadrer ton projet de site." }),
    dir({ profileId: "p-justine", sector: "Santé", skills: ["Kinésithérapie", "Rééducation", "Sport"], lookingFor: "Un cabinet à partager à Guéliz.", offering: "Des conseils posture pour le télétravail." }),
    dir({ profileId: "p-sophie", company: "Lambert RH", sector: "Conseil et stratégie", skills: ["Recrutement", "Marque employeur", "Coaching de carrière"], linkedin: "linkedin.com/in/sophie-lambert", lookingFor: "Des entreprises qui recrutent à Marrakech.", offering: "La relecture de ton CV et de ton profil LinkedIn.", showEmail: true }),
    dir({ profileId: "p-karima", company: "Dar Karima", sector: "Mode, beauté et bijoux", skills: ["Concept-store", "Créatrices marocaines", "Merchandising"], instagram: "@dar.karima", lookingFor: "De nouvelles créatrices à exposer.", offering: "Une vitrine dans ma boutique pour les créatrices du club." }),
    dir({ profileId: "p-anais", company: "Riad Yasmina", sector: "Hôtellerie et restauration", skills: ["Hôtellerie de luxe", "Revenue management", "Équipes"], lookingFor: "Des partenaires pour des séjours bien-être.", offering: "Des tarifs membres pour vos proches de passage." }),
    dir({ profileId: "p-aurelie", sector: "Tech et digital", skills: ["React", "Next.js", "Accessibilité"], linkedin: "linkedin.com/in/aurelie-petit", lookingFor: "Des projets de sites pour des indépendantes.", offering: "Un diagnostic gratuit de ton site.", visibility: "hidden" }),
    dir({ profileId: "p-ambre", sector: "Mode, beauté et bijoux", skills: ["Colorimétrie", "Garde-robe capsule", "Personal shopping"], instagram: "@ambre.image", lookingFor: "Des premières clientes à Marrakech.", offering: "Une analyse couleur à tarif découverte." }),
  ].filter((d) => has.has(d.profileId));

  const generated: DirectoryProfile[] = profiles
    .filter((p) => /^p-g\d+$/.test(p.id))
    .map((p, i) => {
      const hit = SECTOR_OF_JOB.find(([re]) => re.test(p.job ?? ""));
      const visibility = i % 13 === 7 ? "basic" : i % 17 === 9 ? "hidden" : "all";
      return dir({
        profileId: p.id,
        sector: hit?.[1] ?? "Conseil et stratégie",
        skills: (hit?.[2] ?? ["Conseil", "Réseau"]).slice(0, 2 + (i % 2)),
        lookingFor: i % 3 === 0 ? "Rencontrer d’autres entrepreneuses de mon secteur." : null,
        offering: i % 4 === 1 ? "Un café et un retour d’expérience sur mon installation à Marrakech." : null,
        visibility,
        showWhatsapp: i % 5 === 0,
      });
    });
  // Kenza (Bloom House) et Loubna (ostéopathe) ont une fiche complète.
  const kenza = generated.find((d) => d.profileId === "p-g11");
  if (kenza) Object.assign(kenza, { company: "Bloom House", sector: "Bien-être et sport", skills: ["Ateliers bien-être", "Conférences", "Lieu événementiel"], instagram: "@bloomhouse.marrakech", offering: "-15 % sur les ateliers de Bloom House.", visibility: "all" });
  const loubna = generated.find((d) => d.profileId === "p-g34");
  if (loubna) Object.assign(loubna, { company: "Cabinet Loubna Cherkaoui", sector: "Santé", skills: ["Ostéopathie", "Femme enceinte", "Nourrisson"], offering: "Des consultations en français, arabe et anglais.", visibility: "all", showWhatsapp: true });

  /* ---------------- actualités ---------------- */
  const news: NewsPost[] = [
    {
      id: "news-saison", title: "La saison 2026-2027 est lancée", pinned: true, status: "published", authorId: "p-julia", image: "/img/saison-la-terraza.jpg",
      body: "Merci à vous toutes pour cette soirée sur le toit de La Terraza ! Vous étiez plus de cinquante.\n\nAu programme de la saison : un lunch networking chaque mois, deux dîners privés, le tournoi de padel, le Family Day et, nouveauté, des groupes thématiques dans l’appli pour échanger entre deux rendez-vous.\n\nPensez à compléter votre fiche dans l’annuaire : c’est elle qui permet aux autres membres de vous trouver.",
      publishedAt: iso("2026-09-25", "09:00"), createdAt: iso("2026-09-24", "23:10"), updatedAt: iso("2026-09-25", "09:00"),
    },
    {
      id: "news-groupes", title: "Nouveau : les groupes thématiques", pinned: false, status: "published", authorId: "p-nora", image: null,
      body: "Lecture, mamans, entrepreneuses tech, bien-être… Rejoignez les groupes qui vous ressemblent depuis l’onglet Groupes du Cercle. Certains sont ouverts, d’autres sur demande.\n\nUne idée de groupe ? Écrivez-nous, on l’ouvre avec vous.",
      publishedAt: iso("2026-10-06", "18:30"), createdAt: iso("2026-10-06", "18:00"), updatedAt: iso("2026-10-06", "18:30"),
    },
    {
      id: "news-avabay", title: "Retour sur le brunch Neurosciences à AVABAY", pinned: false, status: "published", authorId: "p-julia", image: "/img/brunch-prise-de-parole.jpg",
      body: "Dimanche, une vingtaine de membres ont écouté le Dr Leïla Amrani parler de concentration et de sommeil. Ses trois conseils à retenir : la lumière du matin, une seule tâche à la fois, et pas d’écran une heure avant de dormir.\n\nLes photos sont dans le salon Général.",
      publishedAt: iso("2026-10-12", "11:00"), createdAt: iso("2026-10-12", "10:20"), updatedAt: iso("2026-10-12", "11:00"),
    },
    {
      id: "news-bloom", title: "Offre partenaire : -15 % chez Bloom House", pinned: false, status: "published", authorId: "p-nora", image: null,
      body: "Kenza ouvre les ateliers d’automne de Bloom House aux membres avec 15 % de réduction : respiration, céramique et conférence « Oser se lancer ». Montrez votre carte de membre à l’accueil.",
      publishedAt: iso("2026-10-09", "10:00"), createdAt: iso("2026-10-09", "09:30"), updatedAt: iso("2026-10-09", "10:00"),
    },
    {
      id: "news-family", title: "Family Day : on prépare la journée à la ferme", pinned: false, status: "draft", authorId: "p-julia", image: null,
      body: "Poneys, pique-nique et ateliers pour les enfants à The Ranch Morocco le dimanche 29 novembre. Les inscriptions ouvrent bientôt.",
      publishedAt: null, createdAt: iso("2026-10-13", "16:00"), updatedAt: iso("2026-10-13", "16:00"),
    },
  ];
  const reactions: NewsReaction[] = [];
  const react = (postId: string, ids: string[], kind: ReactionKind, day: string) =>
    ids.filter((id) => has.has(id)).forEach((profileId, i) => reactions.push({ postId, profileId, kind, createdAt: iso(day, `1${i % 10}:0${i % 6}`) }));
  react("news-saison", ["p-salma", "p-maya", "p-chloe", "p-nadia", "p-yasmine", "p-g01", "p-g02", "p-g03", "p-g05", "p-g08", "p-g13", "p-g21"], "like", "2026-09-25");
  react("news-saison", ["p-ines", "p-capucine", "p-anais", "p-g11", "p-g16"], "bravo", "2026-09-25");
  react("news-groupes", ["p-salma", "p-nawal", "p-aurelie", "p-g04", "p-g19"], "like", "2026-10-06");
  react("news-groupes", ["p-karima", "p-sophie"], "merci", "2026-10-07");
  react("news-avabay", ["p-leila", "p-justine", "p-g07", "p-g09", "p-g24", "p-g30"], "like", "2026-10-12");
  react("news-avabay", ["p-ines", "p-emma"], "merci", "2026-10-12");
  react("news-bloom", ["p-leila", "p-g11", "p-g18"], "bravo", "2026-10-09");

  /* ---------------- groupes thématiques ---------------- */
  const group = (o: Pick<ChatGroup, "id" | "slug" | "name" | "description" | "icon" | "joinPolicy"> & Partial<ChatGroup>): ChatGroup => ({
    listed: true, createdBy: "p-julia", createdAt: iso("2026-10-06", "17:00"), archivedAt: null, ...o,
  });
  const groups: ChatGroup[] = [
    group({ id: "grp-lecture", slug: "club-de-lecture", name: "Club de lecture", description: "Un livre par mois, une rencontre au café. Ce mois-ci : « Thinking, Fast and Slow ».", icon: "book", joinPolicy: "open", createdBy: "p-yasmine" }),
    group({ id: "grp-tech", slug: "entrepreneuses-tech", name: "Entrepreneuses tech", description: "Outils, freelances, produits numériques : on s’entraide sur tout ce qui touche au digital.", icon: "spark", joinPolicy: "open" }),
    group({ id: "grp-mamans", slug: "mamans-a-marrakech", name: "Mamans à Marrakech", description: "Écoles, nounous, activités du mercredi : les bons plans des mamans du club.", icon: "home", joinPolicy: "open", createdBy: "p-nora" }),
    group({ id: "grp-bienetre", slug: "bien-etre-et-sport", name: "Bien-être et sport", description: "Yoga, padel, randonnées dans l’Atlas : on se motive ensemble.", icon: "heart", joinPolicy: "open", createdBy: "p-nora" }),
    group({ id: "grp-invest", slug: "investisseuses", name: "Investisseuses", description: "Immobilier, levées de fonds, business angels. Groupe sur demande pour garder des échanges confidentiels.", icon: "crown", joinPolicy: "request" }),
    group({ id: "grp-fondatrices", slug: "cercle-des-fondatrices", name: "Cercle des fondatrices de marque", description: "Groupe privé pour les membres qui dirigent une marque. Sur invitation des fondatrices.", icon: "star", joinPolicy: "request", listed: false }),
  ];
  const groupMembers: GroupMember[] = [];
  const join = (groupId: string, ids: string[], day: string, status: GroupMember["status"] = "member") =>
    ids.filter((id) => has.has(id)).forEach((profileId) =>
      groupMembers.push({ groupId, profileId, status, createdAt: iso(day, "12:00"), decidedBy: status === "member" ? "p-julia" : null, decidedAt: status === "member" ? iso(day, "12:00") : null }),
    );
  join("grp-lecture", ["p-yasmine", "p-salma", "p-ines", "p-emma", "p-sophie", "p-g02", "p-g12", "p-g25"], "2026-10-06");
  join("grp-tech", ["p-julia", "p-nawal", "p-aurelie", "p-ines", "p-maya", "p-g17", "p-g20", "p-g40"], "2026-10-06");
  join("grp-mamans", ["p-nora", "p-lou", "p-capucine", "p-justine", "p-g05", "p-g18", "p-g26"], "2026-10-07");
  join("grp-bienetre", ["p-nora", "p-leila", "p-justine", "p-karima", "p-g11", "p-g34", "p-g06"], "2026-10-07");
  join("grp-invest", ["p-julia", "p-yasmine", "p-anais", "p-g01", "p-g15"], "2026-10-06");
  join("grp-invest", ["p-ines", "p-g09"], "2026-10-13", "pending");
  join("grp-fondatrices", ["p-julia", "p-nora", "p-nadia", "p-karima", "p-g11"], "2026-10-06");

  /* ---------------- messages des groupes et du salon ---------------- */
  const msg = (id: string, channel: string, authorId: string, body: string, day: string, time: string, hiddenAt: string | null = null): Message => ({
    id, channel, authorId, body, createdAt: iso(day, time), readAt: null, ...(hiddenAt ? { hiddenAt } : {}),
  });
  const g = (id: string) => `group:${id}`;
  const messages: Message[] = [
    msg("gmsg-1", g("grp-lecture"), "p-yasmine", "Bienvenue dans le club de lecture ! Première rencontre le jeudi 22 octobre chez Maison Amaj, 18 h.", "2026-10-06", "17:30"),
    msg("gmsg-2", g("grp-lecture"), "p-salma", "Je n’ai lu que la moitié du Kahneman… on parle des chapitres 1 à 15 ?", "2026-10-11", "21:05"),
    msg("gmsg-3", g("grp-lecture"), "p-emma", "Parfait pour moi. J’apporte la version allemande pour comparer les titres, ils sont très drôles.", "2026-10-12", "08:40"),
    msg("gmsg-4", g("grp-lecture"), "p-ines", "Je viens ! Quelqu’un a une idée pour le livre de novembre ?", "2026-10-13", "19:12"),
    msg("gmsg-5", g("grp-tech"), "p-nawal", "Vous utilisez quoi pour la facturation au Maroc ? Je cherche un outil qui gère le dirham et l’euro.", "2026-10-08", "10:15"),
    msg("gmsg-6", g("grp-tech"), "p-aurelie", "J’utilise un tableur et un modèle Word… mais je suis preneuse d’une vraie solution.", "2026-10-08", "11:02"),
    msg("gmsg-7", g("grp-tech"), "p-g20", "Quelqu’un s’intéresse à la crypto pour placer sa trésorerie ? J’ai trouvé une plateforme très rentable.", "2026-10-13", "14:20"),
    msg("gmsg-8", g("grp-tech"), "p-maya", "Je cherche une développeuse pour un petit site vitrine en novembre, budget raisonnable. Des recommandations ?", "2026-10-14", "09:05"),
    msg("gmsg-9", g("grp-mamans"), "p-lou", "Atelier parents-enfants samedi à 10 h à Guéliz, il reste 3 places pour les 4-7 ans.", "2026-10-10", "09:00"),
    msg("gmsg-10", g("grp-mamans"), "p-capucine", "Une école bilingue à conseiller près de l’Hivernage ?", "2026-10-12", "20:30"),
    msg("gmsg-11", g("grp-mamans"), "p-justine", "La nôtre est à Targa, très contente de l’équipe. Je t’envoie le contact en privé.", "2026-10-12", "21:10"),
    msg("gmsg-12", g("grp-bienetre"), "p-leila", "Yoga au lever du soleil dimanche à la Palmeraie, qui vient ? On se retrouve à 7 h.", "2026-10-11", "18:00"),
    msg("gmsg-13", g("grp-bienetre"), "p-g34", "Pensez à bien vous échauffer avant le padel du 7 novembre, je fais un petit rappel sur place si vous voulez.", "2026-10-13", "12:45"),
    msg("gmsg-14", g("grp-invest"), "p-anais", "Retour d’expérience sur l’achat d’un riad en indivision : je peux en parler au prochain lunch.", "2026-10-09", "15:00"),
    msg("gmsg-15", g("grp-invest"), "p-yasmine", "Avec plaisir, et je complète sur la partie juridique (SCI ou SARL).", "2026-10-09", "16:20"),
    msg("gmsg-16", g("grp-fondatrices"), "p-nadia", "Quelqu’un a déjà exporté vers le Canada ? Les démarches douanières me rendent folle.", "2026-10-10", "11:00"),
    msg("gmsg-17", g("grp-fondatrices"), "p-karima", "Oui, je te donne le nom de mon transitaire à Casablanca.", "2026-10-10", "12:30"),
    // salon Général : un message masqué par mot-clé, un autre signalé par une membre
    msg("msg-h1", "general", "p-g27", "[masqué]", "2026-10-13", "22:14", iso("2026-10-13", "22:14")),
    msg("msg-h2", "general", "p-g29", "Je vends mes compléments minceur, -50 % pour les membres du club, écrivez-moi vite !", "2026-10-13", "22:40"),
  ];
  const hiddenBodies = [{ messageId: "msg-h1", body: "Opportunité unique : investissement garanti 30 % par mois, places limitées, écrivez-moi en privé." }];

  /* ---------------- modération ---------------- */
  const keyword = (id: string, kw: string, action: ModerationKeyword["action"], day: string, by = "p-yasmine"): ModerationKeyword => ({ id, keyword: kw, action, createdBy: by, createdAt: iso(day) });
  const keywords: ModerationKeyword[] = [
    keyword("kw-1", "investissement garanti", "hide", "2026-09-12"),
    keyword("kw-2", "arnaque", "hide", "2026-09-12"),
    keyword("kw-3", "pyramide", "hide", "2026-09-12"),
    keyword("kw-4", "crypto", "flag", "2026-09-14"),
    keyword("kw-5", "MLM", "flag", "2026-09-14", "p-julia"),
    keyword("kw-6", "argent facile", "hide", "2026-10-02", "p-julia"),
  ];
  const report = (o: Partial<MessageReport> & Pick<MessageReport, "id" | "messageId" | "source" | "reason" | "messageBody" | "messageAuthorId" | "channel" | "createdAt">): MessageReport => ({
    reporterId: null, keyword: null, status: "open", resolution: null, resolvedBy: null, resolvedAt: null, ...o,
  });
  const reports: MessageReport[] = [
    report({ id: "rep-1", messageId: "msg-h1", source: "keyword", keyword: "investissement garanti", reason: "Masqué automatiquement : « investissement garanti »", messageBody: hiddenBodies[0].body, messageAuthorId: "p-g27", channel: "general", createdAt: iso("2026-10-13", "22:14") }),
    report({ id: "rep-2", messageId: "msg-h2", source: "member", reporterId: "p-salma", reason: "Publicité non sollicitée", messageBody: messages.find((m) => m.id === "msg-h2")!.body, messageAuthorId: "p-g29", channel: "general", createdAt: iso("2026-10-14", "07:55") }),
    report({ id: "rep-3", messageId: "gmsg-7", source: "keyword", keyword: "crypto", reason: "Mot-clé à vérifier : « crypto »", messageBody: messages.find((m) => m.id === "gmsg-7")!.body, messageAuthorId: "p-g20", channel: g("grp-tech"), createdAt: iso("2026-10-13", "14:20") }),
    report({ id: "rep-4", messageId: "msg-2", source: "member", reporterId: "p-g31", reason: "Je pensais que c’était hors sujet", messageBody: "« Thinking, Fast and Slow », de Kahneman. Je peux prêter mon exemplaire.", messageAuthorId: "p-yasmine", channel: "general", status: "resolved", resolution: "dismissed", resolvedBy: "p-julia", resolvedAt: iso("2026-10-14", "10:00"), createdAt: iso("2026-10-14", "09:58") }),
  ].filter((r) => has.has(r.messageAuthorId));

  /* ---------------- notifications ---------------- */
  const notif = (id: string, recipientId: string, type: AppNotification["type"], title: string, body: string, link: string, at: string, read = false): AppNotification => ({
    id, recipientId, type, title, body, link, readAt: read ? at : null, createdAt: at,
  });
  const notifications: AppNotification[] = [
    notif("nt-c1", "p-salma", "news_published", "Retour sur le brunch Neurosciences à AVABAY", "Une nouvelle publication du club.", "/espace/actualites#news-avabay", iso("2026-10-12", "11:00")),
    notif("nt-c2", "p-yasmine", "moderation_report", "Nouveau signalement", "« Je vends mes compléments minceur, -50 % pour les membres… »", "/espace/moderation", iso("2026-10-14", "07:55")),
    notif("nt-c3", "p-julia", "group_request", "Demande pour « Investisseuses »", "Inès Laurent souhaite rejoindre le groupe.", "/fondatrices/communaute/groupes", iso("2026-10-13", "12:00")),
  ].filter((n) => has.has(n.recipientId));

  return {
    news,
    reactions,
    groups,
    groupMembers,
    keywords,
    reports,
    hiddenBodies,
    directory: [...named, ...generated.filter((d) => !named.some((n) => n.profileId === d.profileId))],
    remindersSent: [],
    messages,
    notifications,
  };
}
