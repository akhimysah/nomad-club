/**
 * Données d'exemple du Lot 4 (mode démo et supabase/seed.sql via scripts/seed-sql/engagement.mjs).
 * Date de référence : mercredi 14 octobre 2026. Les identifiants de profils sont ceux de src/lib/seed.ts.
 * N'importe que des types et des modules purs (chargé aussi par Node sans compilation).
 */
import { dealPoints, DEFAULT_SETTINGS } from "./points.ts";
import type { Deal, EngagementSeed, PointsEntry, Product, ProductFile, Purchase, Referral, ReferralReward, RewardGrant } from "./types";

const iso = (ymd: string, time = "10:00") => new Date(`${ymd}T${time}:00+01:00`).toISOString();

export function createEngagementSeed(): EngagementSeed {
  const settings = { ...DEFAULT_SETTINGS, simulatedPayments: true, updatedAt: iso("2026-09-01") };

  /* ---------------- boutique ---------------- */
  const product = (p: Partial<Product> & Pick<Product, "id" | "slug" | "title" | "price" | "priceMember">): Product => ({
    subtitle: null,
    description: "",
    category: "guide",
    coverImage: null,
    previewText: null,
    pages: null,
    status: "published",
    createdAt: iso("2026-06-01"),
    publishedAt: iso("2026-06-01"),
    ...p,
  });
  const products: Product[] = [
    product({
      id: "pr-installer",
      slug: "s-installer-a-marrakech",
      title: "S’installer à Marrakech",
      subtitle: "Le guide pratique des premiers mois",
      category: "guide",
      price: 39,
      priceMember: 29,
      pages: 64,
      coverImage: "/img/saison-la-terraza.jpg",
      description:
        "Carte de séjour, banque, logement, téléphone, assurance santé, écoles : tout ce que les membres auraient aimé savoir en arrivant. Écrit avec les retours de quarante adhérentes, mis à jour chaque saison.",
      previewText:
        "Chapitre 1 · La carte de séjour. Le dossier se dépose au commissariat de ton quartier. Prévois deux photos, ton bail enregistré et une attestation de ressources. Compte six à huit semaines…",
      createdAt: iso("2026-05-10"),
      publishedAt: iso("2026-05-12"),
    }),
    product({
      id: "pr-societe",
      slug: "creer-sa-societe-au-maroc",
      title: "Créer sa société au Maroc",
      subtitle: "SARL, auto-entrepreneuse, statut d’expatriée",
      category: "guide",
      price: 59,
      priceMember: 45,
      pages: 48,
      description:
        "Les étapes au Centre régional d’investissement, le choix du statut, la domiciliation, la comptabilité et les pièges à éviter. Relu par Yasmine Tazi, avocate d’affaires et membre du club.",
      previewText: "Avant de choisir un statut, pose-toi trois questions : qui sont tes clientes, où factures-tu, et combien comptes-tu te verser la première année…",
      createdAt: iso("2026-06-20"),
      publishedAt: iso("2026-06-22"),
    }),
    product({
      id: "pr-carnet",
      slug: "carnet-des-50-adresses",
      title: "Le carnet des 50 adresses",
      subtitle: "Les adresses de Julia et Nora, à emporter",
      category: "carnet",
      price: 19,
      priceMember: 0,
      pages: 32,
      coverImage: "/img/chonchon-chocolat.jpg",
      description: "Restaurants, rooftops, ateliers, médecins, pressings : la version imprimable du carnet du club, offerte aux membres.",
      previewText: "Fer7 · Golf, route d’Amizmiz. Izakaya face aux greens, notre lunch du lundi. Réserve la table du fond…",
      createdAt: iso("2026-04-02"),
      publishedAt: iso("2026-04-02"),
    }),
    product({
      id: "pr-modeles",
      slug: "modeles-devis-factures",
      title: "Modèles de devis et factures",
      subtitle: "Conformes au Maroc, prêts à remplir",
      category: "modele",
      price: 25,
      priceMember: 19,
      pages: 12,
      description: "Six modèles (devis, facture, avoir, relance, bon de commande, contrat de prestation simple) avec les mentions obligatoires marocaines.",
      previewText: null,
      createdAt: iso("2026-07-15"),
      publishedAt: iso("2026-07-16"),
    }),
    product({
      id: "pr-parole",
      slug: "prendre-la-parole-en-public",
      title: "Prendre la parole en public",
      subtitle: "Le support de l’atelier du brunch",
      category: "formation",
      price: 49,
      priceMember: 35,
      pages: 28,
      coverImage: "/img/brunch-prise-de-parole.jpg",
      description: "Le support complet de l’atelier animé au brunch de septembre : structurer un pitch de deux minutes, gérer le trac, répondre aux questions.",
      previewText: "Exercice 1 · Ton histoire en trois phrases : d’où tu viens, ce que tu fais, pour qui. Pas plus de quarante mots…",
      createdAt: iso("2026-09-20"),
      publishedAt: iso("2026-09-21"),
    }),
    product({
      id: "pr-ecoles",
      slug: "guide-des-ecoles",
      title: "Le guide des écoles et crèches",
      subtitle: "Programmes, tarifs, listes d’attente",
      category: "guide",
      price: 29,
      priceMember: 22,
      status: "draft",
      publishedAt: null,
      description: "En préparation avec Lou Garnier : écoles françaises, internationales et bilingues, crèches, activités du mercredi.",
      createdAt: iso("2026-10-05"),
    }),
  ];

  const file = (f: Partial<ProductFile> & Pick<ProductFile, "id" | "productId" | "label" | "fileName">): ProductFile => ({
    storagePath: null,
    sizeBytes: null,
    isPreview: false,
    sortOrder: 0,
    createdAt: iso("2026-06-01"),
    ...f,
  });
  const productFiles: ProductFile[] = [
    file({ id: "pf-installer", productId: "pr-installer", label: "Le guide (PDF)", fileName: "s-installer-a-marrakech.pdf", sizeBytes: 2_400_000 }),
    file({ id: "pf-installer-check", productId: "pr-installer", label: "Check-list des démarches", fileName: "check-list-demarches.pdf", sizeBytes: 180_000, sortOrder: 1 }),
    file({ id: "pf-installer-ext", productId: "pr-installer", label: "Extrait gratuit", fileName: "extrait-s-installer.pdf", sizeBytes: 320_000, isPreview: true, sortOrder: 2 }),
    file({ id: "pf-societe", productId: "pr-societe", label: "Le guide (PDF)", fileName: "creer-sa-societe.pdf", sizeBytes: 1_900_000 }),
    file({ id: "pf-societe-ext", productId: "pr-societe", label: "Extrait gratuit", fileName: "extrait-creer-sa-societe.pdf", sizeBytes: 240_000, isPreview: true, sortOrder: 1 }),
    file({ id: "pf-carnet", productId: "pr-carnet", label: "Le carnet imprimable", fileName: "carnet-50-adresses.pdf", sizeBytes: 3_100_000 }),
    file({ id: "pf-modeles", productId: "pr-modeles", label: "Les six modèles", fileName: "modeles-devis-factures.pdf", sizeBytes: 640_000 }),
    file({ id: "pf-parole", productId: "pr-parole", label: "Le support de l’atelier", fileName: "prendre-la-parole.pdf", sizeBytes: 1_200_000 }),
    file({ id: "pf-parole-fiche", productId: "pr-parole", label: "Fiche mémo à imprimer", fileName: "fiche-memo-pitch.pdf", sizeBytes: 90_000, sortOrder: 1 }),
    file({ id: "pf-ecoles", productId: "pr-ecoles", label: "Le guide (brouillon)", fileName: "guide-des-ecoles.pdf", sizeBytes: null }),
  ];

  const prices = new Map(products.map((p) => [p.id, p.priceMember]));
  const buys: Array<[string, string, string]> = [
    ["p-ines", "pr-carnet", "2026-04-20"],
    ["p-ines", "pr-installer", "2026-05-18"],
    ["p-salma", "pr-societe", "2026-06-25"],
    ["p-maya", "pr-societe", "2026-07-02"],
    ["p-chloe", "pr-installer", "2026-07-08"],
    ["p-capucine", "pr-installer", "2026-07-21"],
    ["p-capucine", "pr-modeles", "2026-07-22"],
    ["p-nawal", "pr-modeles", "2026-08-03"],
    ["p-ambre", "pr-installer", "2026-08-11"],
    ["p-aurelie", "pr-societe", "2026-08-19"],
    ["p-karima", "pr-modeles", "2026-08-30"],
    ["p-justine", "pr-carnet", "2026-09-02"],
    ["p-emma", "pr-installer", "2026-09-10"],
    ["p-yasmine", "pr-parole", "2026-09-22"],
    ["p-sophie", "pr-parole", "2026-09-24"],
    ["p-nadia", "pr-parole", "2026-09-29"],
    ["p-lou", "pr-carnet", "2026-10-03"],
    ["p-g05", "pr-installer", "2026-10-06"],
    ["p-g12", "pr-societe", "2026-10-09"],
    ["p-anais", "pr-parole", "2026-10-12"],
  ];
  const purchases: Purchase[] = buys.map(([profileId, productId, ymd], i) => {
    const amount = prices.get(productId) ?? 0;
    return {
      id: `pu-${i + 1}`,
      productId,
      profileId,
      amount,
      method: amount === 0 ? "free" : "simulated",
      status: "paid",
      paymentRef: amount === 0 ? null : `SIM-${String(4100 + i * 37)}`,
      createdAt: iso(ymd, "18:30"),
    };
  });

  /* ---------------- parrainage ---------------- */
  const referralCodes = [
    { profileId: "p-ines", code: "INES-7K2Q", createdAt: iso("2026-05-02") },
    { profileId: "p-salma", code: "SALMA-4FJD", createdAt: iso("2025-12-01") },
    { profileId: "p-yasmine", code: "YASMINE-9PXA", createdAt: iso("2026-08-15") },
    { profileId: "p-karima", code: "KARIMA-3WTE", createdAt: iso("2025-11-10") },
    { profileId: "p-julia", code: "JULIA-NC01", createdAt: iso("2026-01-05") },
  ];
  const ref = (r: Omit<Referral, "convertedAt"> & { convertedAt?: string | null }): Referral => ({ convertedAt: null, ...r });
  const referrals: Referral[] = [
    ref({ id: "rf-ambre", referrerId: "p-ines", referredId: "p-ambre", referredName: "Ambre F.", code: "INES-7K2Q", status: "member", createdAt: iso("2026-09-18", "19:10"), convertedAt: iso("2026-10-02", "11:00") }),
    ref({ id: "rf-hana", referrerId: "p-ines", referredId: "p-hana", referredName: "Hana I.", code: "INES-7K2Q", status: "signed_up", createdAt: iso("2026-06-12", "21:04") }),
    ref({ id: "rf-clara", referrerId: "p-ines", referredId: "p-clara", referredName: "Clara M.", code: "INES-7K2Q", status: "signed_up", createdAt: iso("2026-09-08", "08:47") }),
    ref({ id: "rf-capucine", referrerId: "p-salma", referredId: "p-capucine", referredName: "Capucine D.", code: "SALMA-4FJD", status: "member", createdAt: iso("2026-01-02", "17:30"), convertedAt: iso("2026-01-14", "10:00") }),
    ref({ id: "rf-sarah", referrerId: "p-yasmine", referredId: "p-sarah", referredName: "Sarah C.", code: "YASMINE-9PXA", status: "signed_up", createdAt: iso("2026-09-24", "12:15") }),
    ref({ id: "rf-g05", referrerId: "p-karima", referredId: "p-g05", referredName: "Rania C.", code: "KARIMA-3WTE", status: "member", createdAt: iso("2025-12-08", "09:00"), convertedAt: iso("2025-12-22", "10:00") }),
  ];
  const rewards: ReferralReward[] = [
    { id: "rw-month", kind: "free_month", label: "Un mois d’adhésion offert", description: "Ajouté à la fin de ton adhésion par les fondatrices.", points: 0, active: true, sortOrder: 0 },
    { id: "rw-points", kind: "points", label: "50 points", description: "Crédités tout de suite sur ton compte de points.", points: 50, active: true, sortOrder: 1 },
    { id: "rw-invite", kind: "invitation", label: "Une invitation pour une amie", description: "Une place offerte à une amie sur le rendez-vous de ton choix.", points: 0, active: false, sortOrder: 2 },
  ];
  const grants: RewardGrant[] = [];
  const points: PointsEntry[] = [];
  for (const r of referrals.filter((x) => x.status === "member")) {
    const at = r.convertedAt ?? r.createdAt;
    const delivered = r.id !== "rf-ambre"; // le mois offert d'Inès reste à remettre
    grants.push(
      { id: `gr-${r.id}-month`, referralId: r.id, rewardId: "rw-month", beneficiaryId: r.referrerId, kind: "free_month", label: "Un mois d’adhésion offert", points: 0, status: delivered ? "delivered" : "granted", createdAt: at, deliveredAt: delivered ? at : null },
      { id: `gr-${r.id}-points`, referralId: r.id, rewardId: "rw-points", beneficiaryId: r.referrerId, kind: "points", label: "50 points", points: 50, status: "delivered", createdAt: at, deliveredAt: at },
    );
    points.push({ id: `pt-${r.id}`, profileId: r.referrerId, points: 50, source: "referral", refId: r.id, label: `Parrainage · ${r.referredName}`, createdAt: at });
  }

  /* ---------------- Espace Business ---------------- */
  type D = Omit<Deal, "pointsEach" | "respondedAt" | "createdAt" | "note"> & { note?: string | null; createdAt?: string; respondedAt?: string | null };
  const raw: D[] = [
    { id: "dl-1", declaredBy: "p-salma", partnerId: "p-capucine", nature: "Décoration de trois appartements en location courte durée", category: "partenariat", amount: 4200, dealDate: "2026-07-04", status: "confirmed" },
    { id: "dl-2", declaredBy: "p-leila", partnerId: "p-g11", nature: "Cours de yoga hebdomadaires à Bloom House", category: "prestation", amount: 1200, dealDate: "2026-06-18", status: "confirmed" },
    { id: "dl-3", declaredBy: "p-emma", partnerId: "p-ines", nature: "Traduction d’une plaquette en allemand", category: "prestation", amount: 800, dealDate: "2026-08-21", status: "confirmed" },
    { id: "dl-4", declaredBy: "p-ines", partnerId: "p-salma", nature: "Stratégie de communication pour l’agence d’architecture", category: "prestation", amount: 2400, dealDate: "2026-09-15", status: "confirmed", note: "Rencontre au lunch du Fer7." },
    { id: "dl-5", declaredBy: "p-chloe", partnerId: "p-anais", nature: "Shooting photo des chambres de l’hôtel", category: "prestation", amount: 3500, dealDate: "2026-08-02", status: "confirmed" },
    { id: "dl-6", declaredBy: "p-maya", partnerId: "p-nadia", nature: "Identité visuelle et packaging de la gamme de soins", category: "prestation", amount: 1800, dealDate: "2026-07-28", status: "confirmed" },
    { id: "dl-7", declaredBy: "p-capucine", partnerId: "p-anais", nature: "Décoration du lobby et du rooftop", category: "vente", amount: 6000, dealDate: "2026-09-05", status: "confirmed" },
    { id: "dl-8", declaredBy: "p-aurelie", partnerId: "p-karima", nature: "Site web du concept-store", category: "prestation", amount: 1500, dealDate: "2026-09-26", status: "confirmed" },
    { id: "dl-9", declaredBy: "p-sophie", partnerId: "p-yasmine", nature: "Recommandation d’une cliente pour un recrutement", category: "recommandation", amount: null, dealDate: "2026-10-01", status: "confirmed" },
    { id: "dl-10", declaredBy: "p-lou", partnerId: "p-justine", nature: "Ateliers parents-bébé au cabinet", category: "partenariat", amount: 600, dealDate: "2026-09-12", status: "refused" },
    { id: "dl-11", declaredBy: "p-nawal", partnerId: "p-emma", nature: "Traduction de l’application d’une start-up", category: "prestation", amount: 1100, dealDate: "2026-10-08", status: "pending" },
    { id: "dl-12", declaredBy: "p-ines", partnerId: "p-karima", nature: "Lancement Instagram du concept-store", category: "prestation", amount: 900, dealDate: "2026-10-10", status: "pending" },
    { id: "dl-13", declaredBy: "p-yasmine", partnerId: "p-ines", nature: "Contrats de prestation types pour les clientes d’Inès", category: "prestation", amount: 1300, dealDate: "2026-10-12", status: "pending", note: "Merci pour la recommandation !" },
    { id: "dl-14", declaredBy: "p-g05", partnerId: "p-karima", nature: "Voyage de presse pour l’ouverture du concept-store", category: "vente", amount: 2600, dealDate: "2026-05-20", status: "confirmed" },
    { id: "dl-15", declaredBy: "p-nadia", partnerId: "p-g11", nature: "Soins signature proposés à Bloom House", category: "vente", amount: 900, dealDate: "2026-04-14", status: "confirmed" },
  ];
  const deals: Deal[] = raw.map((d) => {
    const createdAt = d.createdAt ?? iso(d.dealDate, "20:00");
    const answered = d.status !== "pending";
    const respondedAt = answered ? (d.respondedAt ?? new Date(Date.parse(createdAt) + 26 * 3600_000).toISOString()) : null;
    return { note: null, ...d, createdAt, respondedAt, pointsEach: d.status === "confirmed" ? dealPoints(settings, d.amount) : 0 };
  });
  for (const d of deals.filter((x) => x.status === "confirmed")) {
    for (const who of [d.declaredBy, d.partnerId]) {
      points.push({ id: `pt-${d.id}-${who}`, profileId: who, points: d.pointsEach, source: "deal", refId: d.id, label: `Deal confirmé · ${d.nature}`, createdAt: d.respondedAt ?? d.createdAt });
    }
  }

  /* ---------------- préférences ---------------- */
  const prefs = [
    {
      profileId: "p-ines",
      widgets: [
        { id: "next", enabled: true },
        { id: "weather", enabled: true },
        { id: "news", enabled: true },
        { id: "adhesion", enabled: true },
        { id: "events", enabled: true },
        { id: "prayer", enabled: true },
        { id: "points", enabled: true },
        { id: "salon", enabled: true },
        { id: "agenda", enabled: false },
        { id: "offers", enabled: false },
        { id: "referral", enabled: true },
        { id: "quote", enabled: true },
        { id: "ask", enabled: true },
        { id: "address", enabled: true },
      ] as EngagementSeed["prefs"][number]["widgets"],
      leaderboardOptOut: false,
      updatedAt: iso("2026-10-10"),
    },
    { profileId: "p-yasmine", widgets: [], leaderboardOptOut: true, updatedAt: iso("2026-09-01") },
  ];

  return { settings, prefs, products, productFiles, purchases, referralCodes, referrals, rewards, grants, deals, points };
}
