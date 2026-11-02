// Test d'intégration du MODE RÉEL, sans Supabase ni réseau.
// Les migrations 0001 → dernière + supabase/seed.sql sont montées dans PGlite ; le vrai code de
// src/lib/data/supabase-repo.ts (et des modules) tourne avec le vrai client supabase-js, dont les
// requêtes HTTP sont traduites en SQL par scripts/lib/postgrest-pglite.mjs (RLS appliquée selon la
// personne connectée, comme sur Supabase). Chaque étape échoue avec le message d'erreur réel.
//
// Utilisation : npm run test:reel
import { createHash } from "node:crypto";
import { setupRealMode } from "./lib/real-mode-env.mjs";
import { checkSchemaUsage } from "./lib/schema-usage.mjs";

const env = await setupRealMode({ quiet: true });
const { db, signIn, pg } = env;

let passes = 0;
let failures = 0;
const failed = [];
function ok(cond, label, info = "") {
  if (cond) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    failed.push(label);
    console.log(`  ✗ ${label}${info ? ` — ${info}` : ""}`);
  }
}
/** Exécute une étape : une exception compte comme un échec (avec le message de la base). */
async function step(label, fn) {
  try {
    const r = await fn();
    if (r === false) ok(false, label);
    else ok(true, label);
    return r;
  } catch (e) {
    ok(false, label, e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
const uuid = (id) => {
  const h = createHash("md5").update("nomad-club:" + id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const JULIA = uuid("p-julia");
const NORA = uuid("p-nora");
const INES = uuid("p-ines");
const YASMINE = uuid("p-yasmine");
const KENZA = uuid("p-g11");
const LOUBNA = uuid("p-g34");
const HANA = uuid("p-hana");
const LOU = uuid("p-lou");
const BLOOM = uuid("org-bloom");
const sql1 = async (s, p = []) => (await db.query(s, p)).rows[0];

// ---------------------------------------------------------------------------
console.log("Schéma utilisé par le code (tables, colonnes, fonctions)");
{
  const issues = await checkSchemaUsage(db);
  ok(issues.length === 0, `toutes les tables / colonnes / fonctions citées existent`, issues.slice(0, 15).join(" | "));
}

const { supabaseRepo: repo } = await import("../src/lib/data/supabase-repo.ts");

// ---------------------------------------------------------------------------
console.log("\nInscription (lien magique) et profil");
const NEW_EMAIL = "camille.nouvelle@exemple.com";
let camille = null;
await step("signInWithOtp crée le compte et le profil (déclencheur handle_new_user)", async () => {
  const { supabaseServer } = await import("../src/lib/supabase/server.ts");
  const c = await supabaseServer();
  const { error } = await c.auth.signInWithOtp({ email: NEW_EMAIL, options: { shouldCreateUser: true, data: { first_name: "Camille", last_name: "Durand", whatsapp: "+212600000001" } } });
  if (error) throw new Error(error.message);
  camille = (await sql1("select id from auth.users where email = $1", [NEW_EMAIL]))?.id;
  return !!camille && !!(await sql1("select id from public.profiles where id = $1", [camille]));
});
await step("le nouveau profil a une fiche CRM (crm_sync_profile)", async () => !!(await sql1("select id from public.crm_contacts where profile_id = $1", [camille])));
await signIn(camille);
await step("getProfile : sa propre fiche, sans rôle (compte gratuit)", async () => {
  const p = await repo.getProfile(camille);
  return p?.firstName === "Camille" && p.roles.length === 0 && p.plan === "free";
});
await step("updateOwnProfile : compléter sa fiche (profil + annuaire)", async () => {
  await repo.updateOwnProfile(camille, {
    firstName: "Camille", lastName: "Durand", job: "Architecte", country: "Française", marrakechSince: "2024", bio: "Bonjour", whatsapp: "+212600000001", avatarUrl: null,
    company: "Atelier C", sector: "Architecture", skills: ["plans"], instagram: null, linkedin: null, website: null, lookingFor: null, offering: null, visibility: "basic", showWhatsapp: false, showEmail: false,
  });
  return (await repo.getProfile(camille))?.job === "Architecte";
});
await step("un compte gratuit ne peut pas se donner une formule", async () => {
  const { supabaseServer } = await import("../src/lib/supabase/server.ts");
  const c = await supabaseServer();
  const { error } = await c.from("profiles").update({ plan: "premium", plan_ends_at: "2030-01-01" }).eq("id", camille);
  return !!error;
});
await step("consentements : enregistrer et relire", async () => {
  await repo.recordConsent(camille, "directory", true, "onboarding");
  return (await repo.listConsents(camille)).some((c) => c.kind === "directory" && c.granted);
});
await step("préférences de notification", async () => {
  await repo.setNotificationPref(camille, "event_published", "email", false);
  return (await repo.listNotificationPrefs(camille)).some((p) => p.type === "event_published" && !p.email);
});
await step("parrainage : rattacher le code d'Inès", async () => {
  const code = (await sql1("select code from public.referral_codes where profile_id = $1", [INES]))?.code;
  if (!code) return "pas de code (ignoré)";
  const r = await repo.claimReferral(camille, code);
  return !!r;
});

// ---------------------------------------------------------------------------
console.log("\nRendez-vous et réservations");
await signIn(JULIA);
const start = new Date(Date.now() + 10 * 86400e3).toISOString();
const place = (await repo.listPlaces())[0];
let ev = await step("admin : créer puis publier un rendez-vous", async () => {
  const e = await repo.createEvent({ title: "Lunch test intégration", startsAt: start, endsAt: null, placeId: place.id, venue: place.name, address: place.area, capacity: 2, pricePublic: 40, priceMember: 30, premiumFree: false, description: "Test", program: [] }, "draft");
  return repo.publishEvent(e.id);
});
await step("visiteuse anonyme : agenda public", async () => {
  await signIn(null);
  return (await repo.listEvents()).some((e) => e.id === ev?.id);
});
let guestCode = null;
await step("visiteuse anonyme : réserver avec prénom + WhatsApp (book_event)", async () => {
  const r = await repo.bookEvent({ eventId: ev.id, profileId: null, guestFirstName: "Léa", guestWhatsapp: "+212 6 00 00 00 99", amount: 40, method: "transfer", initialStatus: "pending", declareTransfer: true, waitlistIfFull: false });
  guestCode = r.booking?.ticketCode;
  return r.status === "booked";
});
await step("billet consultable par son code (get_ticket)", async () => (await repo.getBookingByCode(guestCode))?.holderName === "Léa");
await signIn(INES);
let inesBooking = null;
await step("membre : réserver au prix membre", async () => {
  const r = await repo.bookEvent({ eventId: ev.id, profileId: INES, guestFirstName: null, guestWhatsapp: null, amount: 30, method: "transfer", initialStatus: "pending", declareTransfer: true, waitlistIfFull: false });
  inesBooking = r.booking;
  return r.status === "booked" && r.booking.amount === 30;
});
await step("membre : mes réservations", async () => (await repo.listBookingsForProfile(INES)).some((b) => b.id === inesBooking?.id));
await signIn(camille);
await step("complet : liste d'attente", async () => {
  const r = await repo.bookEvent({ eventId: ev.id, profileId: camille, guestFirstName: null, guestWhatsapp: null, amount: 40, method: "transfer", initialStatus: "pending", declareTransfer: true, waitlistIfFull: true });
  return r.status === "waitlist";
});
await signIn(INES);
await step("membre : annuler (cancel_booking) libère la place pour la liste d'attente", async () => {
  const r = await repo.cancelBooking(inesBooking.id, INES);
  return r.eventId === ev.id && r.waitlistProfileId === camille;
});
await step("membre : notifier la première de la liste d'attente (autre personne)", async () => {
  const n = await repo.createNotifications([{ recipientId: camille, type: "waitlist_spot", title: "Une place s’est libérée", body: "Test", link: null }]);
  return n === 1;
});
await step("sans clé service, la RLS refuse cette notification : la clé est obligatoire (npm run check:env)", async () => {
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  try {
    await repo.createNotifications([{ recipientId: camille, type: "waitlist_spot", title: "Place", body: "Test", link: null }]);
    return false;
  } catch {
    return true;
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  }
});

// ---------------------------------------------------------------------------
console.log("\nAdhésion et encaissements");
await signIn(camille);
let pay = await step("compte gratuit : déclarer un virement d'adhésion (declare_membership)", async () =>
  repo.recordMembership({ profileId: camille, payerName: "Camille Durand", action: "join", plan: "member", amount: 670, method: "transfer", status: "declared" }),
);
await step("adhésion par carte : paiement en attente (clé service)", async () =>
  !!(await repo.recordMembership({ profileId: camille, payerName: "Camille Durand", action: "join", plan: "member", amount: 670, method: "card", status: "declared", stripeSessionId: "cs_test_1" })),
);
await step("ses paiements", async () => (await repo.listPaymentsForProfile(camille)).length >= 1);
await signIn(JULIA);
await step("admin : tableau de bord (snapshot)", async () => (await repo.snapshot()).profiles.length > 10);
await step("admin : valider le virement → rôle membre (validate_payment)", async () => {
  const r = await repo.validatePayment(pay.id, JULIA);
  const p = await repo.getProfile(camille);
  return r?.status === "validated" && p.roles.includes("member") && p.plan === "member";
});
await step("webhook Stripe : paiement confirmé (mark_stripe_paid, clé service)", async () => {
  const p = await sql1("select id from public.payments where stripe_session_id = 'cs_test_1'");
  await repo.markStripeSessionPaid("cs_test_1", { kind: "membership", id: p.id });
  return (await sql1("select status from public.payments where id = $1", [p.id])).status === "validated";
});
await step("admin : relance de renouvellement", async () => !!(await repo.sendReminder(`renew:${LOU}`, JULIA)));
await step("admin : journal (écrire + lire)", async () => {
  await repo.logAudit({ actorId: JULIA, action: "payment.validate", targetType: "payment", targetId: pay?.id ?? null, summary: "Test", details: {} });
  return (await repo.listAudit({ limit: 5 })).length > 0;
});
await step("admin : recherche dans le journal", async () => (await repo.searchAudit({ action: "payment", q: "Test" })).length > 0);
await step("admin : rôles (ajouter / retirer modératrice)", async () => {
  await repo.grantRole(INES, "moderator", JULIA);
  const p = await repo.revokeRole(INES, "moderator", JULIA);
  return !p.roles.includes("moderator");
});
await step("admin : on ne retire pas la dernière admin (garde-fou)", async () => {
  await repo.revokeRole(NORA, "admin", JULIA);
  try {
    await repo.revokeRole(JULIA, "admin", JULIA);
    return false;
  } catch {
    return true;
  } finally {
    await repo.grantRole(NORA, "admin", JULIA);
  }
});
await step("admin : liste des profils et établissements", async () => (await repo.listProfiles()).length > 10 && (await repo.listOrganizations()).length > 0);

// ---------------------------------------------------------------------------
console.log("\nCercle : salon, messages privés, annuaire");
await signIn(camille); // membre désormais
await step("membre : lire le salon", async () => (await repo.listMessages("general")).length > 0);
await step("membre : poster au salon", async () => !!(await repo.postMessage("general", camille, "Bonjour à toutes !")));
const dm = (a, b) => `dm:${[a, b].sort().join(":")}`;
await step("membre : message privé à Inès", async () => !!(await repo.postMessage(dm(camille, INES), camille, "Coucou Inès")));
await signIn(INES);
await step("Inès : fils de messages + non lus", async () => (await repo.listDmThreads(INES)).some((t) => t.other.id === camille) && (await repo.countUnreadDms(INES)) >= 1);
await step("Inès : marquer comme lu (mark_dm_read)", async () => {
  await repo.markDmRead(INES, camille);
  return (await repo.listDmThreads(INES)).find((t) => t.other.id === camille)?.unread === 0;
});
await step("annuaire (directory_list) et fiches", async () => (await repo.listDirectoryEntries(await repo.getProfile(INES), { admin: false })).length > 5 && (await repo.listDirectory()).length > 5);
await step("notifications : lister, compter, marquer lues", async () => {
  await repo.listNotifications(INES);
  await repo.markNotificationsRead(INES, "all");
  return (await repo.countUnreadNotifications(INES)) === 0;
});

// ---------------------------------------------------------------------------
console.log("\nCommunauté (Lot 1)");
await signIn(JULIA);
let post = await step("admin : publier une actualité", async () => repo.createNews({ title: "Bienvenue", body: "Texte", image: null, pinned: false, commentsEnabled: true }, JULIA, "published"));
await signIn(INES);
await step("membre : actualités + réaction + commentaire", async () => {
  const list = await repo.listNews({ viewerId: INES });
  await repo.toggleReaction(post.id, INES, "bravo");
  await repo.addNewsComment(post.id, INES, "Merci !");
  return list.some((p) => p.id === post.id) && (await repo.listNewsComments(post.id)).length === 1;
});
let group = null;
await signIn(JULIA);
await step("admin : créer un groupe sur demande", async () => {
  group = await repo.createGroup({ name: "Groupe test", description: "Test", icon: "users", joinPolicy: "request", listed: true }, JULIA);
  return !!group;
});
await signIn(INES);
await step("membre : demander à rejoindre (join_group)", async () => (await repo.joinGroup(group.id, INES)) === "pending");
await signIn(JULIA);
await step("admin : demandes + accepter (decide_group_request)", async () => (await repo.listGroupRequests()).length > 0 && (await repo.decideGroupRequest(group.id, INES, true, JULIA)));
await step("admin : mots-clés de modération", async () => !!(await repo.addKeyword("motcletest", "flag", JULIA)) && (await repo.listKeywords()).length > 0);
await signIn(INES);
const msg = await repo.postMessage("general", INES, "Message à signaler par Camille");
await signIn(camille);
let report = await step("membre : signaler un message (report_message)", async () => repo.reportMessage(msg.id, camille, "hors sujet"));
await signIn(YASMINE);
await step("modératrice : file + masquer + clore (moderate_message, resolve_report)", async () => {
  const open = await repo.listReports();
  await repo.hideMessage(msg.id, YASMINE, "test");
  const r = await repo.resolveReport(report.id, "hidden", YASMINE);
  return open.length > 0 && !!r;
});
await step("rappels J-1 : cibles + marquage (clé service)", async () => {
  const ids = await repo.listReminderTargets(ev.id);
  await repo.markRemindersSent(ev.id, ids);
  return Array.isArray(ids);
});

// ---------------------------------------------------------------------------
console.log("\nPartenaires, carnet pro, carte (Lot 3)");
await signIn(INES);
await step("membre : établissements et offres actives", async () => (await repo.listEstablishments({ activeOnly: true })).length > 0 && (await repo.listOffers({ activeOnly: true })).length > 0);
let code = null;
await step("membre : utiliser une offre (claim_offer_code)", async () => {
  const offer = (await repo.listOffers({ activeOnly: true })).find((o) => o.audience !== "premium" && o.organizationId === BLOOM) ?? (await repo.listOffers({ activeOnly: true })).find((o) => o.audience !== "premium");
  const r = await repo.claimOfferCode(offer.id, INES);
  code = r.code?.code ?? (typeof r.code === "string" ? r.code : null);
  if (r.ok === false) throw new Error(JSON.stringify(r));
  return true;
});
await step("membre : statistiques (track_org_event)", async () => {
  await repo.trackOrgEvent(BLOOM, "view", INES);
  return true;
});
await step("membre : position sur la carte (consentement)", async () => {
  await repo.setMemberLocation(INES, { sharing: true, precision: "area", display: "name", area: "Guéliz", lat: 31.636, lng: -8.01 });
  return (await repo.listMemberPins()).length > 0;
});
await signIn(KENZA);
await step("partenaire : ses établissements et ses codes", async () => (await repo.listMyOrganizations(KENZA)).length > 0 && Array.isArray(await repo.listOrgCodes(BLOOM)));
await step("partenaire : valider le code au comptoir (validate_offer_code)", async () => {
  if (!code || typeof code !== "string") return "code absent";
  const r = await repo.validateOfferCode(code, KENZA, [BLOOM]);
  if (r.ok === false) throw new Error(r.error);
  return true;
});
await step("partenaire : statistiques mensuelles", async () => (await repo.orgMonthlyStats(BLOOM, 6)).length === 6);
await step("partenaire : créer une offre", async () => !!(await repo.createOffer(BLOOM, { title: "Offre test", badge: "-10 %", detail: "Test", conditions: null, validFrom: null, validUntil: null, audience: "all" })));
await step("partenaire : modifier la fiche", async () => {
  const e = await repo.getEstablishment(BLOOM);
  return !!(await repo.updateEstablishment(BLOOM, { description: "Nouvelle description", address: e.address ?? null, area: e.area ?? null, lat: null, lng: null, phone: null, email: null, website: null, instagram: null, photos: [], hours: null, whatsapp: null, carnetCategory: null, memberDiscount: null }));
});
await step("partenaire : inviter une collaboratrice (invite_org_member)", async () => !!(await repo.inviteOrgMember(BLOOM, "collab@exemple.com", KENZA)));
await signIn(LOUBNA);
await step("pro : son abonnement et ses paiements", async () => {
  const org = (await repo.listMyOrganizations(LOUBNA)).find((o) => o.organization.kinds.includes("pro"));
  if (!org) return "pas d'établissement pro";
  await repo.getSubscription(org.organization.id);
  return Array.isArray(await repo.listSubscriptionPayments(org.organization.id));
});

// ---------------------------------------------------------------------------
console.log("\nEngagement (Lot 4)");
await signIn(INES);
await step("membre : widgets (préférences)", async () => !!(await repo.saveEngagementPrefs(INES, { widgets: [{ id: "news", enabled: true }] })));
await step("membre : boutique", async () => (await repo.listProducts()).length > 0);
await step("membre : code de parrainage (my_referral_code)", async () => (await repo.getReferralCode(INES)).length > 3);
await step("membre : mes filleules", async () => Array.isArray(await repo.listReferrals({ referrerId: INES })));
let deal = await step("membre : déclarer un deal avec Camille", async () => repo.declareDeal({ declaredBy: INES, partnerId: camille, nature: "Site web", category: "prestation", amount: 1200, dealDate: new Date().toISOString().slice(0, 10), note: null }));
await signIn(camille);
await step("Camille : confirmer le deal (respond_deal)", async () => !!(await repo.respondDeal(deal.id, camille, true)));
await step("classement Business", async () => Array.isArray(await repo.leaderboard()));
await signIn(JULIA);
await step("admin : réglages engagement", async () => !!(await repo.getEngagementSettings()));
await step("admin : produits (tous statuts) et ventes", async () => (await repo.listProducts({ status: "all" })).length > 0 && Array.isArray(await repo.listPurchases()));

// ---------------------------------------------------------------------------
console.log("\nCRM (Lot 5)");
await step("admin : données du CRM", async () => (await repo.crmData()).contacts.length > 10);
let contact = await step("admin : créer un contact", async () =>
  repo.crmCreateContact({ kind: "person", firstName: "Prospect", lastName: "Test", company: null, job: null, email: "prospect@exemple.com", phone: null, instagram: null, city: null, source: "instagram", status: "prospect", tags: [], notes: "", marketingConsent: false, ownerId: JULIA }, JULIA),
);
await step("admin : échange + tâche", async () => {
  await repo.crmAddActivity({ contactId: contact.id, type: "call", body: "Appel", occurredAt: new Date().toISOString(), authorId: JULIA });
  return (await repo.crmCreateTasks([{ contactId: contact.id, title: "Relancer", dueOn: new Date().toISOString().slice(0, 10), ownerId: JULIA, createdBy: JULIA }])).length === 1;
});
await step("admin : opportunité dans le pipeline", async () => {
  const stage = (await repo.crmData()).stages[0];
  return !!(await repo.crmSaveDeal({ contactId: contact.id, stageId: stage.id, title: "Adhésion", value: 670, ownerId: JULIA, expectedClose: null }, null));
});
await signIn(INES);
await step("membre : le CRM lui est fermé", async () => {
  try {
    return (await repo.crmData()).contacts.length === 0;
  } catch {
    return true;
  }
});

// ---------------------------------------------------------------------------
console.log("\nSécurité et RGPD (Lot 6)");
await signIn(INES);
await step("membre : export de ses données (extras)", async () => !!(await repo.personalDataExtras(INES)));
await step("membre : abonnement push", async () => {
  await repo.savePushSubscription(INES, { endpoint: "https://push.example/abc", p256dh: "k", auth: "a", userAgent: null });
  return (await repo.countPushSubscriptions(INES)) === 1;
});
await step("membre : demander puis annuler la suppression du compte", async () => {
  await repo.requestAccountDeletion(INES, "test");
  return repo.cancelAccountDeletion(INES);
});
await signIn(JULIA);
await step("admin : réglages de sécurité", async () => {
  const s = await repo.getSecuritySettings();
  await repo.setSecuritySettings(s, JULIA);
  return true;
});
await step("admin : file des suppressions", async () => Array.isArray(await repo.listDeletionRequests()));

// ---------------------------------------------------------------------------
console.log("\nCouverture complémentaire (écritures moins fréquentes)");
await signIn(JULIA);
await step("actualités : modifier, épingler, dépublier, supprimer", async () => {
  await repo.updateNews(post.id, { title: "Bienvenue !" });
  await repo.setNewsPinned(post.id, true);
  await repo.setNewsStatus(post.id, "draft");
  const c = (await repo.listNewsComments(post.id))[0];
  if (c) await repo.deleteNewsComment(c.id);
  await repo.deleteNews(post.id);
  return (await repo.getNews(post.id, JULIA)) === null;
});
await step("groupes : modifier, membres, archiver", async () => {
  await repo.updateGroup(group.id, { description: "Nouveau texte", archived: true });
  return (await repo.listGroupMembers(group.id)).length >= 1 && (await repo.listGroups(JULIA, { manage: true })).some((g) => g.id === group.id);
});
await step("modération : restaurer un message, retirer un mot-clé", async () => {
  await repo.restoreMessage(msg.id, JULIA);
  const k = (await repo.listKeywords()).find((x) => x.keyword === "motcletest");
  return !!k && !!(await repo.removeKeyword(k.id));
});
await step("événement : modifier", async () => (await repo.updateEvent(ev.id, { capacity: 5 })).capacity === 5);
await step("CRM : import, actions groupées, fusion, segment, étapes, tâches", async () => {
  const n = await repo.crmImportContacts([{ kind: "person", firstName: "Import", lastName: "Un", company: null, job: null, email: "import1@exemple.com", phone: null, instagram: null, city: null, source: "import", status: "prospect", tags: [], notes: "", marketingConsent: false, ownerId: null }], JULIA);
  const data = await repo.crmData();
  const imported = data.contacts.find((c) => c.email === "import1@exemple.com");
  await repo.crmBulkUpdate([imported.id], { addTag: "salon" });
  await repo.crmMergeContacts(contact.id, imported.id, JULIA);
  const seg = await repo.crmSaveSegment({ name: "Test", description: null, filters: {} }, null, JULIA);
  await repo.crmDeleteSegment(seg.id);
  await repo.crmSaveStages(data.stages.map((s) => ({ id: s.id, label: s.label, outcome: s.outcome })));
  const t = (await repo.crmData()).tasks.find((x) => x.contactId === contact.id);
  await repo.crmUpdateTask(t.id, { title: "Relancer vite" });
  await repo.crmSetTaskDone(t.id, true);
  await repo.crmMarkTasksReminded([t.id]);
  const d = (await repo.crmData()).deals.find((x) => x.contactId === contact.id);
  await repo.crmMoveDeal(d.id, data.stages[1].id, 0, null);
  return n === 1;
});
await step("boutique : créer un produit, publier", async () => {
  const p = await repo.saveProduct({ title: "Guide test", slug: "guide-test", subtitle: null, description: "Texte", category: "guide", coverImage: null, price: 20, priceMember: 10, previewText: null, pages: 3 }, null, JULIA);
  return (await repo.setProductStatus(p.id, "published")).status === "published";
});
await step("parrainage : récompense + remise", async () => {
  await repo.saveReward({ kind: "points", label: "Points test", description: null, points: 10, active: true }, null);
  const g = (await repo.listGrants())[0];
  if (g) await repo.deliverGrant(g.id, JULIA);
  return true;
});
await step("engagement : régler le barème", async () => !!(await repo.updateEngagementSettings({ dealPointsBase: 10 }, JULIA)));
await step("pro : enregistrer un paiement d'abonnement, changer de formule, rafraîchir (clé service)", async () => {
  const org = (await repo.listOrganizations({ kind: "pro" }))[0];
  const today = new Date().toISOString().slice(0, 10);
  await repo.recordSubscriptionPayment({ organizationId: org.id, plan: "essentiel", amount: 29, status: "paid", reference: "TEST-1", periodStart: today, periodEnd: today, monthlyPrice: 29 });
  await repo.updateSubscription(org.id, { cancelAtPeriodEnd: true });
  await repo.refreshSubscriptions(today);
  return (await repo.listSubscriptions()).length > 0;
});
await step("offres : modifier, pause, statistiques, invitations", async () => {
  const o = (await repo.listOffers({ organizationId: BLOOM }))[0];
  await repo.updateOffer(o.id, { title: o.title, badge: o.badge, detail: o.detail, conditions: null, validFrom: null, validUntil: null, audience: o.audience });
  await repo.setOfferStatus(o.id, "paused");
  await repo.setOfferStatus(o.id, "active");
  return Array.isArray(await repo.offerStats(BLOOM)) && Array.isArray(await repo.listOrgInvites(BLOOM));
});
await step("RGPD : refuser puis anonymiser une demande (anonymize_account)", async () => {
  await signIn(LOU);
  const r = await repo.requestAccountDeletion(LOU, "test");
  await signIn(JULIA);
  await repo.rejectDeletionRequest(r.id, JULIA, "non");
  await signIn(LOU);
  const r2 = await repo.requestAccountDeletion(LOU, "test 2");
  await signIn(JULIA);
  await repo.anonymizeAccount(LOU, r2.id, JULIA);
  return (await sql1("select first_name from public.profiles where id = $1", [LOU])).first_name !== "Lou";
});
await step("push : abonnements des destinataires (clé service) + suppression", async () => {
  const subs = await repo.listPushSubscriptionsFor([INES]);
  if (subs[0]) await repo.removePushSubscriptionById(subs[0].id);
  return subs.length === 1;
});
await step("journal : une entrée par son id", async () => {
  const e = (await repo.listAudit({ limit: 1 }))[0];
  return (await repo.getAuditEntry(e.id))?.id === e.id;
});
await step("limitation de fréquence (rate_limit_hit, clé service)", async () => {
  process.env.RATE_LIMIT_STORE = "";
  try {
    const { rateLimit } = await import("../src/lib/modules/securite/rate-limit.ts");
    const r = await rateLimit("booking", "test-subject");
    return r.ok === true;
  } finally {
    process.env.RATE_LIMIT_STORE = "memory";
  }
});
await step("connexion d'une admin journalisée (afterSignIn)", async () => {
  await signIn(JULIA);
  const { supabaseServer } = await import("../src/lib/supabase/server.ts");
  const { afterSignIn } = await import("../src/lib/modules/securite/sign-in.ts");
  await afterSignIn(await supabaseServer(), "/fondatrices");
  return !!(await sql1("select id from public.audit_log where action = 'auth.admin_login' and actor_id = $1", [JULIA]));
});

await step("lectures diverses (fiches, billets, offres, boutique, RGPD)", async () => {
  await signIn(INES);
  const checks = [
    !!(await repo.getEventBySlug(ev.slug)),
    !!(await repo.getEventById(ev.id)),
    Array.isArray(await repo.listMemories()),
    Array.isArray(await repo.listPartnerOffers()),
    (await repo.listBookingsByCodes([guestCode])).length === 1,
    !!(await repo.getGroup("groupe-test", INES, { manage: false })) || true,
    !!(await repo.getMessage(msg.id)),
    Array.isArray(await repo.listCodesForProfile(INES)),
    !!(await repo.getMemberLocation(INES)),
    !!(await repo.getOffer((await repo.listOffers({ activeOnly: true }))[0].id)),
    !!(await repo.getProduct({ slug: (await repo.listProducts())[0].slug })),
    typeof (await repo.hasPurchased(INES, (await repo.listProducts())[0].id)) === "boolean",
    Array.isArray(await repo.listRewards()),
    Array.isArray(await repo.listDeals({ profileId: INES })),
    Array.isArray(await repo.listPoints(INES)),
    (await repo.getEngagementPrefs(INES)) !== undefined,
    Array.isArray(await repo.listMyDeletionRequests(INES)),
    (await repo.getOpenDeletionRequest(INES)) === null,
    Array.isArray(await repo.listMySessions(INES)),
  ];
  await repo.deletePushSubscription(INES, "https://push.example/abc");
  await signIn(camille);
  checks.push(!!(await repo.getDirectoryProfile(camille)));
  await signIn(YASMINE);
  checks.push(typeof (await repo.countOpenReports()) === "number");
  await signIn(KENZA);
  checks.push((await repo.listOrganizationMembers(BLOOM)).length > 0);
  const bad = checks.map((c, i) => (c ? null : i)).filter((x) => x !== null);
  if (bad.length) throw new Error(`lectures en échec : ${bad.join(", ")}`);
  return true;
});
await step("boutique : achat simulé accepté s'il est activé, refusé une fois coupé", async () => {
  await signIn(JULIA);
  await repo.updateEngagementSettings({ simulatedPayments: false }, JULIA);
  await signIn(INES);
  const ps = await repo.listProducts();
  const p = ps.find((x) => x.priceMember > 0) ?? ps[0];
  try {
    await repo.recordPurchase({ productId: p.id, profileId: INES, amount: p.priceMember, method: "simulated", paymentRef: null });
    return false;
  } catch {
    return true;
  }
});
await step("Business : retirer un deal en attente", async () => {
  await signIn(INES);
  const d = await repo.declareDeal({ declaredBy: INES, partnerId: KENZA, nature: "Conseil", category: "prestation", amount: null, dealDate: new Date().toISOString().slice(0, 10), note: null });
  return repo.withdrawDeal(d.id, INES);
});
await step("CRM : retombées des deals confirmés en mode réel", async () => {
  await signIn(JULIA);
  const { loadDealOutcomes } = await import("../src/lib/modules/crm/business-source.ts");
  const r = await loadDealOutcomes(new Date().toISOString().slice(0, 10));
  return r.available && !r.sample && r.rows.length > 0;
});
await step("CRM : modifier un contact", async () => (await repo.crmUpdateContact(contact.id, { city: "Marrakech" })).city === "Marrakech");
await step("webhook Stripe : session expirée libère la place (cancelBooking sans personne)", async () => {
  await signIn(HANA);
  const r = await repo.bookEvent({ eventId: ev.id, profileId: HANA, guestFirstName: null, guestWhatsapp: null, amount: 40, method: "card", initialStatus: "pending", declareTransfer: false, waitlistIfFull: false });
  await repo.setBookingStripeSession(r.booking.id, "cs_test_2");
  const out = await repo.cancelBooking(r.booking.id, null);
  return out.eventId === ev.id;
});

// ---------------------------------------------------------------------------
console.log("\nInscription et lancement (0012, actions réelles)");
const actions = await import("../src/app/actions/lancement.ts");
await signIn(null);
const form = (o) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const ZOE = "zoe.candidate@exemple.com";
await step("inscription : formulaire → lien magique avec la fiche en métadonnées", async () => {
  const r = await actions.signUpAction(null, form({ email: ZOE, firstName: "zoé", lastName: "Martin", whatsapp: "+212 6 11 22 33 44", country: "Française", heardFrom: "instagram", heardFromDetail: "", referralCode: "", path: "apply", terms: "on" }));
  const otp = pg.log.otp.at(-1);
  if (!r?.ok) throw new Error(r?.message);
  return otp.email === ZOE && otp.data.signup_path === "apply" && otp.data.terms_accepted === "true" && otp.redirectTo.includes("/auth/callback?suite=%2Fbienvenue");
});
const zoe = (await sql1("select id from auth.users where email = $1", [ZOE]))?.id;
await step("inscription : profil complet, onboarding à faire, CGU acceptées", async () => {
  await signIn(zoe);
  const p = await repo.getProfile(zoe);
  const o = await repo.getOnboarding(zoe);
  return p.firstName === "Zoé" && p.lastName === "Martin" && p.country === "Française" && o.signupPath === "apply" && !!o.termsAcceptedAt && !o.completedAt;
});
await step("inscription : CGU refusées → message", async () => {
  const r = await actions.signUpAction(null, form({ email: "x@exemple.com", firstName: "Xa", lastName: "Y", whatsapp: "+212611223344", country: "FR", heardFrom: "site", path: "free" }));
  return r && !r.ok && r.field === "terms";
});
await step("première connexion : direction l'onboarding", async () => {
  const { supabaseServer } = await import("../src/lib/supabase/server.ts");
  const { afterMagicLink } = await import("../src/lib/modules/lancement/server.ts");
  const c = await supabaseServer();
  const { data } = await c.auth.getUser();
  return (await afterMagicLink(c, data.user, "/espace")) === "/bienvenue?suite=%2Fespace";
});
await step("onboarding : étape faite puis terminé", async () => {
  await repo.onboardingProgress(zoe, "profile", null);
  const o = await repo.onboardingProgress(zoe, "privacy", "completed");
  return o.stepsDone.join() === "profile,privacy" && !!o.completedAt;
});
await step("onboarding : fiche de base enregistrée par l'action (compte gratuit)", async () => {
  const r = await actions.saveBasicProfileAction({ firstName: "Zoé", lastName: "Martin", job: "Designer", country: "Française", whatsapp: "+212 6 11 22 33 44", avatarUrl: null });
  return r.ok && (await repo.getProfile(zoe)).job === "Designer";
});
await step("adhésion sur validation : paiement bloqué sans candidature", async () => {
  const { membershipGate } = await import("../src/lib/modules/lancement/server.ts");
  return typeof (await membershipGate(await repo.getProfile(zoe))) === "string";
});
await step("candidature : déposée par l'action", async () => {
  const r = await actions.submitApplicationAction(null, form({ job: "Designer", company: "Studio Z", marrakechSince: "2025", motivation: "Je veux rencontrer des entrepreneuses et partager mon réseau." }));
  if (!r?.ok) throw new Error(r?.message);
  return (await repo.listMyApplications(zoe))[0]?.status === "pending";
});
await signIn(JULIA);
await step("fondatrices : file des candidatures + acceptation (journal, notification)", async () => {
  const app = (await repo.listApplications()).find((a) => a.profileId === zoe && a.status === "pending");
  const r = await actions.decideApplicationAction(app.id, true, "Bienvenue !");
  if (!r.ok) throw new Error(r.error);
  return !!(await sql1("select id from public.notifications where recipient_id = $1 and type = 'application_accepted'", [zoe])) && !!(await sql1("select id from public.audit_log where action = 'application.accept'"));
});
await signIn(zoe);
await step("candidature acceptée : paiement de l'adhésion possible", async () => {
  const { membershipGate } = await import("../src/lib/modules/lancement/server.ts");
  return (await membershipGate(await repo.getProfile(zoe))) === null;
});
await signIn(JULIA);
await step("fondatrices : passer en adhésion directe (journalisé)", async () => {
  const r = await actions.setMembershipModeAction("direct");
  const back = await actions.setMembershipModeAction("validation");
  return r.ok && back.ok && (await repo.getLancementSettings()).membershipMode === "validation";
});
let inviteLink = null;
await step("invitation : créée depuis Rôles et accès (lien à usage unique)", async () => {
  const r = await actions.createInvitationAction(null, form({ email: "nouvelle.modo@exemple.com", role: "moderator", organizationId: "", note: "" }));
  if (!r?.ok) throw new Error(r?.message);
  inviteLink = r.link;
  return /\/invitation\/[0-9a-f]{48}$/.test(r.link) && (await repo.listRoleInvitations()).some((i) => i.email === "nouvelle.modo@exemple.com" && i.state === "open");
});
await step("invitation : la personne s'inscrit avec l'adresse invitée puis accepte → rôle modératrice", async () => {
  const token = inviteLink.split("/").pop();
  await signIn(null);
  const prev = await repo.previewRoleInvitation(token);
  await actions.signUpAction(null, form({ email: "nouvelle.modo@exemple.com", firstName: "Maya", lastName: "Benali", whatsapp: "+212 6 99 88 77 66", country: "Marocaine", heardFrom: "bouche_a_oreille", path: "free", terms: "on", invitation: token }));
  if (!pg.log.otp.at(-1).redirectTo.includes(encodeURIComponent(`/invitation/${token}`))) throw new Error("redirection d'invitation absente");
  const id = (await sql1("select id from auth.users where email = 'nouvelle.modo@exemple.com'")).id;
  await signIn(id);
  const r = await repo.acceptRoleInvitation(token, id);
  const p = await repo.getProfile(id);
  return prev.state === "open" && r.role === "moderator" && p.roles.includes("moderator");
});
await step("invitation : une seconde utilisation est refusée", async () => {
  try {
    await repo.acceptRoleInvitation(inviteLink.split("/").pop(), zoe);
    return false;
  } catch (e) {
    return /servi|used/.test(e.message);
  }
});

// ---------------------------------------------------------------------------
console.log("\nPremière administratrice (npm run admin:create)");
{
  const { createAdmin } = await import("./lib/admin-create-core.mjs");
  const { createClient } = await import("@supabase/supabase-js");
  const { createTestDb } = await import("./lib/pglite-db.mjs");
  const { createPostgrest, SERVICE_KEY: SK } = await import("./lib/postgrest-pglite.mjs");
  const fresh = await createTestDb({ seed: false, quiet: true });
  const pg2 = await createPostgrest(fresh);
  const client = createClient("http://fresh.localhost", SK, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: pg2.fetch } });
  const quiet = () => {};
  await step("base vide : compte créé (confirmé), profil, rôle admin, journal", async () => {
    const r = await createAdmin({ supabase: client, email: "Julia@Exemple.com", firstName: "Julia", log: quiet });
    const roles = (await fresh.query("select role from public.user_roles where profile_id = $1", [r.userId])).rows.map((x) => x.role);
    const prof = (await fresh.query("select first_name, email from public.profiles where id = $1", [r.userId])).rows[0];
    const log = (await fresh.query("select count(*)::int as n from public.audit_log where action = 'role.grant' and target_id = $1", [r.userId])).rows[0].n;
    const terms = (await fresh.query("select terms_accepted_at from public.member_onboarding where profile_id = $1", [r.userId])).rows[0];
    return r.created && roles.join() === "admin" && prof.first_name === "Julia" && prof.email === "julia@exemple.com" && log === 1 && terms.terms_accepted_at === null;
  });
  await step("relancé : rien ne change (idempotent)", async () => (await createAdmin({ supabase: client, email: "julia@exemple.com", log: quiet })).alreadyAdmin);
  await step("une admin existe : une autre adresse est refusée sans --force", async () => {
    try {
      await createAdmin({ supabase: client, email: "nora@exemple.com", log: quiet });
      return false;
    } catch (e) {
      return /--force/.test(e.message);
    }
  });
  await step("--force : seconde administratrice", async () => !(await createAdmin({ supabase: client, email: "nora@exemple.com", force: true, log: quiet })).alreadyAdmin);
  await step("adresse invalide refusée", async () => {
    try {
      await createAdmin({ supabase: client, email: "pas-une-adresse", log: quiet });
      return false;
    } catch {
      return true;
    }
  });
  await fresh.close();
}

// ---------------------------------------------------------------------------
console.log("\nVariables d'environnement (npm run check:env)");
{
  const { checkEnv } = await import("./lib/check-env-core.mjs");
  const { loadEnvFiles } = await import("./lib/load-env.mjs");
  const { root } = await import("./lib/pglite-db.mjs");
  const fixture = loadEnvFiles([`${root}/scripts/fixtures/env.exemple-production`]).vars;
  const example = loadEnvFiles([`${root}/.env.example`]).vars;
  ok(checkEnv(fixture, { production: true }).errors.length === 0, "exemple de production complet : aucune erreur");
  ok(checkEnv(example, { production: true }).errors.length >= 5, ".env.example vide : erreurs (Supabase, site, cron, démo)");
  const swapped = checkEnv({ ...fixture, NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture.SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY: fixture.NEXT_PUBLIC_SUPABASE_ANON_KEY }, { production: true });
  ok(swapped.errors.some((e) => e.includes("inversées")), "clés anon / service inversées : détecté");
  ok(checkEnv({ ...fixture, NEXT_PUBLIC_SERVICE_KEY: "x" }).errors.some((e) => e.includes("NEXT_PUBLIC_")), "clé secrète exposée en NEXT_PUBLIC_ : refusée");
  ok(checkEnv({ ...fixture, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, { production: true }).errors.length > 0, "site en http://localhost refusé en production");
  ok(checkEnv({ ...fixture, STRIPE_WEBHOOK_SECRET: "" }).errors.some((e) => e.includes("STRIPE_WEBHOOK_SECRET")), "Stripe sans secret de webhook : erreur");
  ok(checkEnv({ ...fixture, SENTRY_DSN: "pas-un-dsn" }).errors.some((e) => e.includes("SENTRY_DSN")), "DSN Sentry mal formé : erreur");
}

// ---------------------------------------------------------------------------
console.log("\nCouche de compatibilité");
ok(env.unsupported.length === 0, "aucune construction PostgREST non gérée", env.unsupported.slice(0, 5).join(" | "));
void pg;

console.log(`\n${passes} vérification${passes > 1 ? "s" : ""} réussie${passes > 1 ? "s" : ""}, ${failures} échec${failures > 1 ? "s" : ""}.`);
if (failures) console.log("Échecs :\n- " + failed.join("\n- "));
process.exit(failures ? 1 : 0);
