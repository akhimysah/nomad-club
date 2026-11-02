/**
 * Lot 3 — données d'exemple : partenaires et leurs offres, pros abonnés du carnet, codes utilisés,
 * statistiques sur 6 mois (mai → octobre 2026) et membres qui partagent leur position (approximative).
 * Fichier de données pur (imports de types seulement) : il est lu par src/lib/seed.ts et par scripts/seed-sql.mjs.
 */
import type { Organization, OrganizationMember, PartnerOffer, Profile } from "../../types";
import { QUARTIERS } from "./quartiers.ts";
import type { EstablishmentDetails, MemberLocation, Offer, OfferCode, OrgInvite, PartenairesSeed, ProSubscription, SubscriptionPayment } from "./types";

const iso = (ymd: string, time = "10:00") => new Date(`${ymd}T${time}:00+01:00`).toISOString();

/** Les 6 mois de statistiques d'exemple (le mois en cours de la démo est octobre 2026). */
export const SEED_MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"] as const;


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

type Base = { profiles: Profile[]; organizations: Organization[]; organizationMembers: OrganizationMember[]; partnerOffers: PartnerOffer[] };

/**
 * Complète les données du socle (nouveaux établissements, rattachements, rôle pro de Rim)
 * et renvoie les tables du module. Appelée une seule fois par createSeed().
 */
export function partenairesSeed(base: Base): PartenairesSeed & { offers: Offer[] } {
  const rnd = prng(20261103);
  const org = (o: Partial<Organization> & Pick<Organization, "id" | "slug" | "name" | "kinds" | "category">): Organization => ({
    description: null, address: null, area: null, lat: null, lng: null, contactName: null, phone: null, email: null, website: null, instagram: null,
    status: "active", placeId: null, createdAt: iso("2026-04-02"), ...o,
  });

  /* ---------- établissements : compléments du socle ---------- */
  const amaj = base.organizations.find((o) => o.id === "org-amaj");
  if (amaj && !amaj.kinds.includes("pro")) amaj.kinds = ["partner", "pro"]; // partenaire ET pro du carnet
  const rim = base.profiles.find((p) => p.id === "p-rim");
  if (rim && !rim.roles.includes("pro")) rim.roles = [...rim.roles, "pro"];

  const added: Organization[] = [
    org({ id: "org-padel", slug: "urban-padel", name: "Urban Padel", kinds: ["partner"], category: "Sport · padel", description: "Six terrains couverts à Targa, cours collectifs et tournois féminins.", address: "Route de Targa", area: "Targa", lat: 31.6515, lng: -8.0505, contactName: "Mehdi Alaoui", phone: "+212 6 70 11 22 33", email: "bonjour@urbanpadel.example", instagram: "@urbanpadel.mkech", placeId: "pl-padel", createdAt: iso("2026-03-10") }),
    org({ id: "org-zitoun", slug: "spa-dar-zitoun", name: "Spa Dar Zitoun", kinds: ["partner"], category: "Bien-être · hammam", description: "Hammam traditionnel et soins dans un riad de la Médina, à deux pas de Riad Zitoun el Jdid.", address: "Derb Zitoun, Riad Zitoun el Jdid", area: "Médina", lat: 31.6265, lng: -7.9875, contactName: "Fatima Zahra Ouali", phone: "+212 5 24 38 90 12", email: "spa@darzitoun.example", instagram: "@spadarzitoun", createdAt: iso("2026-04-15") }),
    org({ id: "org-terre", slug: "atelier-terre-et-feu", name: "Atelier Terre & Feu", kinds: ["partner"], category: "Ateliers · céramique", description: "Cours de tournage et de modelage dans un atelier lumineux de la Palmeraie.", address: "Circuit de la Palmeraie, km 6", area: "Palmeraie", lat: 31.673, lng: -7.965, contactName: "Ines Benali", phone: "+212 6 61 45 78 90", email: "atelier@terreetfeu.example", instagram: "@terreetfeu.atelier", createdAt: iso("2026-05-02") }),
    org({ id: "org-idrissi", slug: "maitre-salma-idrissi", name: "Maître Salma Idrissi, avocate", kinds: ["pro"], category: "Droit des affaires", description: "Création de société, baux commerciaux, droit du travail. Rendez-vous en français, arabe et anglais.", address: "Avenue Mohammed VI, immeuble Le Prestige", area: "Hivernage", lat: 31.6215, lng: -8.017, contactName: "Salma Idrissi", phone: "+212 6 62 30 41 52", email: "cabinet@idrissi-avocate.example", website: "https://idrissi-avocate.example", createdAt: iso("2026-05-12") }),
    org({ id: "org-berrada", slug: "dr-amina-berrada", name: "Dr Amina Berrada, pédiatre", kinds: ["pro"], category: "Santé · pédiatrie", description: "Pédiatre, suivi du nourrisson et de l’enfant, vaccinations. Consultations le samedi matin.", address: "Rue de Yougoslavie", area: "Guéliz", lat: 31.6365, lng: -8.0075, contactName: "Amina Berrada", phone: "+212 5 24 42 18 30", email: "cabinet@dr-berrada.example", createdAt: iso("2026-06-01") }),
    org({ id: "org-lina", slug: "studio-lina-coiffure", name: "Studio Lina coiffure", kinds: ["pro"], category: "Beauté · coiffure", description: "Coupes, couleurs végétales et soins des cheveux bouclés.", address: "Rue Bab Agnaou", area: "Médina", lat: 31.631, lng: -7.9905, contactName: "Lina Amrani", phone: "+212 6 64 52 63 74", createdAt: iso("2026-06-20") }),
    org({ id: "org-alaoui", slug: "atelier-nadia-alaoui", name: "Atelier Nadia Alaoui", kinds: ["pro"], category: "Architecture d’intérieur", description: "Rénovation de riads et d’appartements, suivi de chantier.", address: "Route de Fès, Palmeraie", area: "Palmeraie", lat: 31.668, lng: -7.979, contactName: "Nadia Alaoui", phone: "+212 6 65 63 74 85", createdAt: iso("2026-04-28") }),
  ];
  for (const o of added) if (!base.organizations.some((x) => x.id === o.id)) base.organizations.push(o);

  /* ---------- fiches complètes ---------- */
  const det = (organizationId: string, d: Partial<EstablishmentDetails>): EstablishmentDetails => ({
    organizationId, photos: [], hours: null, whatsapp: null, carnetCategory: null, memberDiscount: null, updatedAt: iso("2026-09-15"), ...d,
  });
  const details: EstablishmentDetails[] = [
    det("org-bloom", { photos: ["chill-connect-groupe.jpg", "brunch-prise-de-parole.jpg"], hours: "Du mardi au samedi, 9 h – 19 h", whatsapp: "+212 6 61 20 33 14", carnetCategory: "bien-etre-sport" }),
    det("org-amaj", { photos: ["chonchon-chocolat.jpg"], hours: "Tous les jours, 7 h 30 – 20 h", whatsapp: "+212 6 60 43 87 12", carnetCategory: "manger", memberDiscount: "Une boîte de 6 macarons offerte dès 300 DH de commande" }),
    det("org-cherkaoui", { hours: "Lundi – vendredi, 9 h – 18 h · samedi matin", whatsapp: "+212 6 62 18 40 55", carnetCategory: "sante", memberDiscount: "-10 % sur la première séance" }),
    det("org-padel", { photos: ["padel.jpg"], hours: "Tous les jours, 8 h – 23 h", whatsapp: "+212 6 70 11 22 33", carnetCategory: "bien-etre-sport" }),
    det("org-zitoun", { photos: ["body-agency.jpg"], hours: "Tous les jours, 10 h – 21 h (dames le matin)", whatsapp: "+212 6 61 38 90 12", carnetCategory: "beaute" }),
    det("org-terre", { photos: ["saison-la-terraza.jpg"], hours: "Mercredi – dimanche, 10 h – 18 h", whatsapp: "+212 6 61 45 78 90", carnetCategory: "famille" }),
    det("org-idrissi", { hours: "Sur rendez-vous, lundi – vendredi", whatsapp: "+212 6 62 30 41 52", carnetCategory: "pratique", memberDiscount: "Premier rendez-vous de 30 min offert" }),
    det("org-berrada", { hours: "Lundi – samedi, 9 h – 13 h et 15 h – 19 h", whatsapp: "+212 6 63 18 30 40", carnetCategory: "sante" }),
    det("org-lina", { hours: "Mardi – samedi, 10 h – 19 h", whatsapp: "+212 6 64 52 63 74", carnetCategory: "beaute", memberDiscount: "-15 % sur les soins" }),
    det("org-alaoui", { hours: "Sur rendez-vous", whatsapp: "+212 6 65 63 74 85", carnetCategory: "pratique" }),
  ];

  /* ---------- offres ---------- */
  const offer = (o: Partial<Offer> & Pick<Offer, "id" | "badge" | "partner" | "detail" | "organizationId" | "title">): Offer => ({
    conditions: null, validFrom: null, validUntil: null, audience: "all", status: "active", createdAt: iso("2026-05-01"), ...o,
  });
  const offers: Offer[] = [
    offer({ id: "off-bloom", badge: "-15 %", partner: "Bloom House", title: "-15 % sur les ateliers", detail: "Sur les ateliers et conférences", organizationId: "org-bloom", conditions: "Hors événements privés. Une utilisation par atelier.", audience: "member", createdAt: iso("2026-02-10") }),
    offer({ id: "off-bloom-2", badge: "Offert", partner: "Bloom House", title: "Un atelier découverte offert", detail: "Ton premier atelier respiration offert", organizationId: "org-bloom", conditions: "Une fois par membre Premium, sur réservation.", audience: "premium", validUntil: "2026-12-31", createdAt: iso("2026-06-01") }),
    offer({ id: "off-amaj", badge: "Café", partner: "Maison Amaj", title: "Un café offert", detail: "Un café offert avec ta viennoiserie", organizationId: "org-amaj", conditions: "Sur place uniquement, du lundi au vendredi.", createdAt: iso("2026-05-20") }),
    offer({ id: "off-padel", badge: "1 h", partner: "Urban Padel", title: "Une heure de terrain offerte", detail: "Une heure de terrain offerte par trimestre", organizationId: "org-padel", conditions: "Réserver 3 jours avant, en semaine avant 17 h.", audience: "member", createdAt: iso("2026-03-15") }),
    offer({ id: "off-zitoun", badge: "-20 %", partner: "Spa Dar Zitoun", title: "-20 % sur le hammam", detail: "Hammam et gommage traditionnel", organizationId: "org-zitoun", conditions: "Valable du dimanche au jeudi.", createdAt: iso("2026-04-20") }),
    offer({ id: "off-zitoun-2", badge: "Soin", partner: "Spa Dar Zitoun", title: "Massage de 30 min offert", detail: "Pour un soin de 60 min acheté", organizationId: "org-zitoun", audience: "premium", createdAt: iso("2026-07-01") }),
    offer({ id: "off-terre", badge: "-10 %", partner: "Atelier Terre & Feu", title: "-10 % sur les cours", detail: "Cours de tournage et de modelage", organizationId: "org-terre", conditions: "Sur les cartes de 5 et 10 cours.", createdAt: iso("2026-05-05") }),
    offer({ id: "off-terre-ete", badge: "Stage", partner: "Atelier Terre & Feu", title: "Stage d’été enfants -25 %", detail: "Stage de 5 matinées pour les 6–12 ans", organizationId: "org-terre", status: "paused", validFrom: "2026-07-01", validUntil: "2026-08-31", createdAt: iso("2026-06-10") }),
  ];
  // Le socle n'avait pas relié Urban Padel : on garde la liste « legacy » cohérente.
  base.partnerOffers.forEach((p) => {
    if (p.id === "off-padel") p.organizationId = "org-padel";
  });

  /* ---------- codes utilisés (6 mois) et statistiques ---------- */
  const circle = base.profiles.filter((p) => p.roles.some((r) => r === "member" || r === "moderator") && p.id !== "p-ines").map((p) => p.id);
  const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const used = new Set<string>();
  const newCode = () => {
    for (;;) {
      let s = "OF-";
      for (let i = 0; i < 8; i++) {
        s += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)];
        if (i === 3) s += "-";
      }
      if (!used.has(s)) {
        used.add(s);
        return s;
      }
    }
  };
  const owner: Record<string, string> = { "org-bloom": "p-g11", "org-amaj": "p-rim" };
  // Popularité de chaque établissement (vues de fiche par mois, en moyenne).
  const POP: Record<string, number> = {
    "org-bloom": 120, "org-amaj": 160, "org-padel": 90, "org-zitoun": 140, "org-terre": 60,
    "org-cherkaoui": 75, "org-idrissi": 55, "org-berrada": 95, "org-lina": 40, "org-alaoui": 30,
  };
  const offerCodes: OfferCode[] = [];
  const stats: PartenairesSeed["stats"] = [];
  SEED_MONTHS.forEach((month, mi) => {
    const growth = 0.7 + mi * 0.09;
    for (const [orgId, pop] of Object.entries(POP)) {
      const o = base.organizations.find((x) => x.id === orgId);
      if (!o) continue;
      // les établissements ne comptent qu'à partir de leur arrivée
      if (o.createdAt.slice(0, 7) > month) continue;
      const views = Math.round(pop * growth * (0.85 + rnd() * 0.3));
      const isPro = o.kinds.includes("pro");
      stats.push({
        organizationId: orgId,
        month: `${month}-01`,
        views,
        contactClicks: isPro ? Math.round(views * (0.08 + rnd() * 0.06)) : Math.round(views * 0.03),
        whatsappClicks: isPro ? Math.round(views * (0.12 + rnd() * 0.08)) : Math.round(views * 0.05),
        directionsClicks: Math.round(views * (0.06 + rnd() * 0.06)),
      });
      // codes : environ 1 vue sur 6 génère un code, 75 % sont validés en caisse
      const orgOffers = offers.filter((x) => x.organizationId === orgId && (x.validFrom ?? "0000") <= `${month}-31` && x.createdAt.slice(0, 7) <= month);
      if (!orgOffers.length) continue;
      const n = Math.round(views / 6);
      const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
      for (let k = 0; k < n; k++) {
        const of = orgOffers[Math.floor(rnd() * orgOffers.length)];
        const isCurrent = month === "2026-10";
        const day = 1 + Math.floor(rnd() * (isCurrent ? 13 : daysInMonth));
        const created = iso(`${month}-${String(day).padStart(2, "0")}`, `${String(9 + Math.floor(rnd() * 10)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`);
        const validated = rnd() < 0.75;
        offerCodes.push({
          id: `oc-${offerCodes.length + 1}`,
          offerId: of.id,
          organizationId: orgId,
          profileId: circle[Math.floor(rnd() * circle.length)],
          code: newCode(),
          createdAt: created,
          validatedAt: validated ? new Date(Date.parse(created) + (10 + Math.floor(rnd() * 50)) * 60000).toISOString() : null,
          validatedBy: validated ? (owner[orgId] ?? null) : null,
        });
      }
    }
  });
  // Un code « ouvert » d'une membre ne peut exister qu'une fois par offre : on ne garde que le plus récent.
  const open = new Map<string, OfferCode>();
  for (const c of offerCodes) {
    if (c.validatedAt) continue;
    const k = `${c.offerId}:${c.profileId}`;
    const prev = open.get(k);
    if (prev) prev.validatedAt = new Date(Date.parse(prev.createdAt) + 30 * 60000).toISOString();
    open.set(k, c);
  }

  /* ---------- abonnements des pros ---------- */
  const sub = (s: Pick<ProSubscription, "organizationId" | "plan" | "monthlyPrice" | "status" | "startedAt" | "currentPeriodEnd">): ProSubscription => ({ cancelAtPeriodEnd: false, updatedAt: iso("2026-10-01"), ...s });
  const subscriptions: ProSubscription[] = [
    sub({ organizationId: "org-cherkaoui", plan: "visibilite", monthlyPrice: 49, status: "active", startedAt: "2026-09-01", currentPeriodEnd: "2026-11-01" }),
    sub({ organizationId: "org-amaj", plan: "essentiel", monthlyPrice: 29, status: "active", startedAt: "2026-06-05", currentPeriodEnd: "2026-11-05" }),
    sub({ organizationId: "org-idrissi", plan: "vitrine", monthlyPrice: 89, status: "active", startedAt: "2026-05-12", currentPeriodEnd: "2026-11-12" }),
    sub({ organizationId: "org-berrada", plan: "visibilite", monthlyPrice: 49, status: "active", startedAt: "2026-06-01", currentPeriodEnd: "2026-11-01" }),
    sub({ organizationId: "org-lina", plan: "essentiel", monthlyPrice: 29, status: "past_due", startedAt: "2026-06-20", currentPeriodEnd: "2026-10-08" }),
    sub({ organizationId: "org-alaoui", plan: "visibilite", monthlyPrice: 49, status: "suspended", startedAt: "2026-04-28", currentPeriodEnd: "2026-08-28" }),
  ];
  const subscriptionPayments: SubscriptionPayment[] = [];
  const addMonth = (ymd: string, n: number) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, Math.min(d, 28)));
    return dt.toISOString().slice(0, 10);
  };
  for (const s of subscriptions) {
    // un paiement par mois écoulé, du début jusqu'à la dernière échéance payée
    let start = s.startedAt;
    let i = 0;
    while (addMonth(start, 1) <= s.currentPeriodEnd && i < 12) {
      const end = addMonth(start, 1);
      subscriptionPayments.push({
        id: `sp-${s.organizationId}-${i + 1}`,
        organizationId: s.organizationId,
        plan: s.plan,
        amount: s.monthlyPrice,
        status: "paid",
        method: "simulated",
        reference: `SIM-${s.organizationId.slice(4, 8).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
        periodStart: start,
        periodEnd: end,
        createdAt: iso(start, "08:00"),
      });
      start = end;
      i++;
    }
    if (s.status !== "active") {
      subscriptionPayments.push({
        id: `sp-${s.organizationId}-echec`,
        organizationId: s.organizationId,
        plan: s.plan,
        amount: s.monthlyPrice,
        status: "failed",
        method: "simulated",
        reference: `SIM-${s.organizationId.slice(4, 8).toUpperCase()}-ECHEC`,
        periodStart: s.currentPeriodEnd,
        periodEnd: addMonth(s.currentPeriodEnd, 1),
        createdAt: iso(s.currentPeriodEnd, "08:00"),
      });
    }
  }

  /* ---------- équipe ---------- */
  const extraMembers: OrganizationMember[] = [{ organizationId: "org-bloom", profileId: "p-g20", role: "staff", createdAt: iso("2026-07-01") }];
  for (const m of extraMembers) if (!base.organizationMembers.some((x) => x.organizationId === m.organizationId && x.profileId === m.profileId)) base.organizationMembers.push(m);
  const staff = base.profiles.find((p) => p.id === "p-g20");
  if (staff && !staff.roles.includes("partner")) staff.roles = [...staff.roles, "partner"];
  const invites: OrgInvite[] = [
    { id: "inv-1", organizationId: "org-bloom", email: "sara.atelier@exemple.com", invitedBy: "p-g11", createdAt: iso("2026-10-09", "15:20"), acceptedAt: null, acceptedBy: null },
  ];

  /* ---------- positions (approximatives) des membres qui ont consenti ---------- */
  const at = (name: string) => QUARTIERS.find((q) => q.name === name)!;
  const loc = (profileId: string, area: string, precision: MemberLocation["precision"], display: MemberLocation["display"], jitter: [number, number] = [0, 0]): MemberLocation => {
    const q = at(area);
    const round = (v: number) => Math.round(v / 0.005) * 0.005;
    return {
      profileId, sharing: true, precision, display, area,
      lat: precision === "area" ? q.lat : round(q.lat + jitter[0]),
      lng: precision === "area" ? q.lng : round(q.lng + jitter[1]),
      consentedAt: iso("2026-09-20"), updatedAt: iso("2026-10-01"),
    };
  };
  const refused: MemberLocation = { profileId: "p-g11", sharing: false, precision: "area", display: "name", area: null, lat: null, lng: null, consentedAt: null, updatedAt: iso("2026-09-02") };
  const locations: MemberLocation[] = [
    loc("p-yasmine", "Hivernage", "approx", "name", [0.004, -0.006]),
    loc("p-g02", "Guéliz", "area", "name"),
    loc("p-g05", "Guéliz", "approx", "name", [0.006, 0.005]),
    loc("p-g08", "Médina", "approx", "anonymous", [-0.003, 0.004]),
    loc("p-g15", "Palmeraie", "area", "name"),
    loc("p-g18", "Targa", "approx", "name", [0.002, 0.007]),
    loc("p-g27", "Semlalia", "area", "anonymous"),
    loc("p-g30", "Agdal", "approx", "name", [0.004, 0.002]),
    // Kenza a refusé : la ligne existe mais rien n'est partagé.
    refused,
  ].filter((l) => base.profiles.some((p) => p.id === l.profileId));

  return { offers, details, offerCodes, stats, subscriptions, subscriptionPayments, invites, locations };
}
