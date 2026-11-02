"use server";

/**
 * Lot 3 — actions des partenaires, des pros et des membres (offres, codes, fiches, abonnement, équipe, carte).
 * Chaque action vérifie la capacité et le rattachement à l'établissement, journalise ce qui compte et revalide les pages.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { checkCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName, money } from "@/lib/format";
import { paySubscription } from "@/lib/modules/partenaires/billing";
import { changeProPlan, setProCancelAtPeriodEnd } from "@/lib/modules/paiements/service"; // --- Vague 2 · paiements ---
import { inMarrakech, isAudience, isCategory, isProPlan, normalizeOfferCode, PRO_PLANS, quartier, validationUrl } from "@/lib/modules/partenaires/domain";
import { orgAccess } from "@/lib/modules/partenaires/server";
import type { EstablishmentInput, OfferInput, ValidatedCode } from "@/lib/modules/partenaires/types";
import { roleGranted } from "@/lib/notify";
import { rolesCan } from "@/lib/permissions";
import { qrData, type QrData } from "@/lib/qr";
import { siteUrl } from "@/lib/site";

export type FormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const text = (fd: FormData, k: string): string | null => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v : null;
};
const fail = (message: string, errors?: Record<string, string>): FormState => ({ ok: false, message, errors });

function zodErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function revalidateOrg() {
  revalidatePath("/partenaire", "layout");
  revalidatePath("/pro", "layout");
  revalidatePath("/espace", "layout");
}

/* =====================================================================
   Membres : utiliser une offre, statistiques de clic, position sur la carte
   ===================================================================== */

export type ClaimView = { ok: true; code: string; createdAt: string; qr: QrData } | { ok: false; error: string };

/** « Utiliser l'offre » : code personnel horodaté + QR (le QR ouvre la validation dans l'espace partenaire). */
export async function claimOfferAction(offerId: string): Promise<ClaimView> {
  const me = await checkCapability("offers.use");
  if (!me) return { ok: false, error: "Réservé aux membres du club." };
  const r = await getRepo().claimOfferCode(offerId, me.profile.id);
  if (!r.ok) return r;
  return { ok: true, code: r.code.code, createdAt: r.code.createdAt, qr: qrData(validationUrl(await siteUrl(), r.code.code)) };
}

const locationSchema = z.object({
  sharing: z.boolean(),
  precision: z.enum(["area", "approx"]),
  display: z.enum(["name", "anonymous"]),
  area: z.string().max(60).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

/** Réglages de position : consentement explicite, précision (quartier / ~500 m), visibilité du nom. */
export async function saveLocationAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await checkCapability("location.share");
  if (!me) return fail("Réservé aux membres du club.");
  const sharing = fd.get("sharing") === "on";
  const consent = fd.get("consent") === "on";
  if (sharing && !consent) return fail("Coche la case de consentement pour apparaître sur la carte.", { consent: "Consentement requis." });
  const area = text(fd, "area");
  const q = quartier(area);
  const precision = fd.get("precision") === "approx" ? "approx" : "area";
  let lat: number | null = null;
  let lng: number | null = null;
  if (sharing) {
    if (!q) return fail("Choisis ton quartier.", { area: "Choisis ton quartier." });
    const gl = Number(fd.get("lat"));
    const gg = Number(fd.get("lng"));
    // ~500 m : on accepte un point du navigateur s'il est à Marrakech (il sera arrondi), sinon le centre du quartier
    if (precision === "approx" && Number.isFinite(gl) && Number.isFinite(gg) && gl !== 0 && inMarrakech(gl, gg)) {
      lat = gl;
      lng = gg;
    } else {
      lat = q.lat;
      lng = q.lng;
    }
  }
  const input = locationSchema.safeParse({ sharing, precision, display: fd.get("display") === "anonymous" ? "anonymous" : "name", area: sharing ? (q?.name ?? null) : null, lat, lng });
  if (!input.success) return fail("Réglages invalides.", zodErrors(input.error));
  try {
    await getRepo().setMemberLocation(me.profile.id, input.data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Enregistrement impossible.");
  }
  revalidatePath("/espace/carte", "layout");
  return { ok: true, message: sharing ? "Ta position approximative est visible par les membres." : "Ta position est retirée de la carte." };
}

/** Retirer sa position d'un geste (bouton « Ne plus partager »). */
export async function stopSharingAction(): Promise<FormState> {
  const me = await checkCapability("location.share");
  if (!me) return fail("Réservé aux membres du club.");
  const cur = await getRepo().getMemberLocation(me.profile.id);
  await getRepo().setMemberLocation(me.profile.id, { sharing: false, precision: cur?.precision ?? "area", display: cur?.display ?? "name", area: null, lat: null, lng: null });
  revalidatePath("/espace/carte", "layout");
  return { ok: true, message: "Ta position est retirée de la carte." };
}

/* =====================================================================
   Établissement : fiche, équipe
   ===================================================================== */

const urlOrPath = z
  .string()
  .max(300)
  .refine((v) => /^https:\/\/\S+$/.test(v) || /^[\w.-]+\.(jpe?g|png|webp|avif)$/i.test(v), "Adresse de photo invalide (https://… ou nom de fichier du dossier /img).");

const estSchema = z.object({
  description: z.string().max(800).nullable(),
  address: z.string().max(200).nullable(),
  area: z.string().max(60).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  phone: z.string().max(40).nullable(),
  email: z.string().email("E-mail invalide.").max(160).nullable(),
  website: z.string().url("Adresse web invalide (https://…).").max(200).nullable(),
  instagram: z.string().max(80).nullable(),
  photos: z.array(urlOrPath).max(8, "8 photos au plus."),
  hours: z.string().max(400).nullable(),
  whatsapp: z.string().max(40).nullable(),
  carnetCategory: z.string().nullable().refine((v) => v === null || isCategory(v), "Catégorie inconnue."),
  memberDiscount: z.string().max(160).nullable(),
});

export async function saveEstablishmentAction(organizationId: string, _: FormState, fd: FormData): Promise<FormState> {
  const acc = await orgAccess(organizationId, "organizations.manage_own");
  if (!acc) return fail("Tu ne peux pas modifier cet établissement.");
  const coord = (k: string) => {
    const v = text(fd, k);
    return v === null ? null : Number(v.replace(",", "."));
  };
  let lat = coord("lat");
  let lng = coord("lng");
  const area = text(fd, "area");
  // sans coordonnées : centre du quartier, pour apparaître quand même sur la carte
  if ((lat === null || lng === null) && quartier(area)) {
    lat = quartier(area)!.lat;
    lng = quartier(area)!.lng;
  }
  if (lat !== null && lng !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || !inMarrakech(lat, lng))) return fail("La position doit être à Marrakech.", { lat: "Position hors de Marrakech." });
  const parsed = estSchema.safeParse({
    description: text(fd, "description"), address: text(fd, "address"), area, lat, lng,
    phone: text(fd, "phone"), email: text(fd, "email"), website: text(fd, "website"), instagram: text(fd, "instagram"),
    photos: String(fd.get("photos") ?? "").split(/\s*\n\s*/).map((s) => s.trim()).filter(Boolean),
    hours: text(fd, "hours"), whatsapp: text(fd, "whatsapp"), carnetCategory: text(fd, "carnetCategory"), memberDiscount: text(fd, "memberDiscount"),
  });
  if (!parsed.success) return fail("Vérifie les champs signalés.", zodErrors(parsed.error));
  const input = parsed.data as EstablishmentInput;
  try {
    const e = await getRepo().updateEstablishment(organizationId, input);
    await audit({ actorId: acc.profile.id, action: "organization.update", targetType: "organization", targetId: organizationId, summary: `Fiche de ${e.name} mise à jour` });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Enregistrement impossible.");
  }
  revalidateOrg();
  return { ok: true, message: "Fiche enregistrée. Les membres voient la nouvelle version." };
}

export async function inviteMemberAction(organizationId: string, _: FormState, fd: FormData): Promise<FormState> {
  const acc = await orgAccess(organizationId, "team.invite", { owner: true });
  if (!acc) return fail("Seule la propriétaire de l’établissement invite son équipe.");
  const email = z.string().trim().toLowerCase().email("E-mail invalide.").safeParse(fd.get("email"));
  if (!email.success) return fail("E-mail invalide.", { email: "E-mail invalide." });
  const repo = getRepo();
  const r = await repo.inviteOrgMember(organizationId, email.data, acc.profile.id);
  if (!r.ok) return fail(r.error);
  const org = await repo.getEstablishment(organizationId);
  await audit({ actorId: acc.profile.id, action: "organization.invite", targetType: "organization", targetId: organizationId, summary: `${email.data} invitée dans l’équipe de ${org?.name ?? "l’établissement"}`, details: { joined: r.joinedProfileId } });
  if (r.joinedProfileId && org) await roleGranted(r.joinedProfileId, org.kinds.includes("partner") ? "partner" : "pro");
  // --- E-mails --- invitation d'équipe envoyée à l'adresse saisie
  if (org)
    await (await import("@/lib/modules/emails/triggers")).sendTeamInvite({
      email: email.data,
      inviterName: acc.profile.firstName,
      organizationName: org.name,
      kind: org.kinds.includes("partner") ? "partner" : "pro",
      joinedProfileId: r.joinedProfileId ?? null,
    });
  revalidateOrg();
  return { ok: true, message: r.joinedProfileId ? "Elle fait maintenant partie de l’équipe : son espace est ouvert." : "Invitation enregistrée : elle rejoindra l’équipe à la création de son compte." };
}

/* =====================================================================
   Offres partenaires
   ===================================================================== */

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").nullable();
const offerSchema = z
  .object({
    title: z.string().min(3, "Donne un titre à l’offre.").max(80),
    badge: z.string().min(1, "Indique la réduction ou l’avantage (« -15 % », « Offert »…).").max(10, "10 caractères au plus."),
    detail: z.string().min(3, "Décris l’offre en une phrase.").max(160),
    conditions: z.string().max(400).nullable(),
    validFrom: ymd,
    validUntil: ymd,
    audience: z.string().refine(isAudience, "Public inconnu."),
  })
  .refine((o) => !o.validFrom || !o.validUntil || o.validUntil >= o.validFrom, { message: "La fin doit suivre le début.", path: ["validUntil"] });

export async function saveOfferAction(organizationId: string, offerId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const acc = await orgAccess(organizationId, "offers.manage_own");
  if (!acc) return fail("Tu ne peux pas gérer les offres de cet établissement.");
  const parsed = offerSchema.safeParse({
    title: text(fd, "title") ?? "", badge: text(fd, "badge") ?? "", detail: text(fd, "detail") ?? "", conditions: text(fd, "conditions"),
    validFrom: text(fd, "validFrom"), validUntil: text(fd, "validUntil"), audience: text(fd, "audience") ?? "all",
  });
  if (!parsed.success) return fail("Vérifie les champs signalés.", zodErrors(parsed.error));
  const input = parsed.data as OfferInput;
  const repo = getRepo();
  try {
    if (offerId) {
      const cur = await repo.getOffer(offerId);
      if (!cur || cur.organizationId !== organizationId) return fail("Offre introuvable.");
      await repo.updateOffer(offerId, input);
      await audit({ actorId: acc.profile.id, action: "offer.update", targetType: "organization", targetId: organizationId, summary: `Offre « ${input.title} » modifiée`, details: { offerId } });
    } else {
      const o = await repo.createOffer(organizationId, input);
      await audit({ actorId: acc.profile.id, action: "offer.create", targetType: "organization", targetId: organizationId, summary: `Offre « ${input.title} » créée`, details: { offerId: o.id } });
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Enregistrement impossible.");
  }
  revalidateOrg();
  return { ok: true, message: offerId ? "Offre mise à jour." : "Offre en ligne : les membres la voient déjà." };
}

export async function setOfferStatusAction(offerId: string, paused: boolean): Promise<{ ok: boolean; message: string }> {
  const repo = getRepo();
  const o = await repo.getOffer(offerId);
  if (!o?.organizationId) return { ok: false, message: "Offre introuvable." };
  const acc = await orgAccess(o.organizationId, "offers.manage_own");
  if (!acc) return { ok: false, message: "Tu ne peux pas gérer cette offre." };
  await repo.setOfferStatus(offerId, paused ? "paused" : "active");
  await audit({ actorId: acc.profile.id, action: paused ? "offer.pause" : "offer.resume", targetType: "organization", targetId: o.organizationId, summary: `Offre « ${o.title} » ${paused ? "mise en pause" : "remise en ligne"}`, details: { offerId } });
  revalidateOrg();
  return { ok: true, message: paused ? "Offre en pause : elle n’apparaît plus aux membres." : "Offre remise en ligne." };
}

/* =====================================================================
   Validation d'un code au comptoir
   ===================================================================== */

export type ValidateState = { ok: true; validated: ValidatedCode } | { ok: false; error: string } | null;

export async function validateCodeAction(_: ValidateState, fd: FormData): Promise<ValidateState> {
  const me = await checkCapability("offers.validate");
  if (!me) return { ok: false, error: "Réservé aux établissements partenaires." };
  const code = normalizeOfferCode(String(fd.get("code") ?? ""));
  if (!code) return { ok: false, error: "Code incomplet : il ressemble à OF-7KQD-M3XP." };
  const repo = getRepo();
  const mine = (await repo.listMyOrganizations(me.profile.id)).filter((m) => m.organization.kinds.includes("partner")).map((m) => m.organization.id);
  const scope = mine.length ? mine : rolesCan(me.roles, "organizations.manage_all") ? "all" : [];
  const r = await repo.validateOfferCode(code, me.profile.id, scope);
  if (!r.ok) return r;
  if (r.validated.organizationId) {
    await audit({
      actorId: me.profile.id, action: "offer_code.validate", targetType: "organization", targetId: r.validated.organizationId,
      summary: `Code ${r.validated.code} validé · ${r.validated.offerTitle} (${r.validated.firstName})`, details: { code: r.validated.code, by: fullName(me.profile) },
    });
  }
  revalidatePath("/partenaire", "layout");
  return r;
}

/* =====================================================================
   Abonnement des pros — Vague 2 · paiements : prestataire réel (Stripe), simulé en démo (voir billing.ts)
   ===================================================================== */

export async function paySubscriptionAction(organizationId: string, plan: string, simulateFailure = false): Promise<{ ok: boolean; message: string; url?: string }> {
  const acc = await orgAccess(organizationId, "subscription.manage_own");
  if (!acc) return { ok: false, message: "Tu ne peux pas gérer cet abonnement." };
  if (!isProPlan(plan)) return { ok: false, message: "Formule inconnue." };
  const r = await paySubscription(organizationId, plan, acc.profile, { base: await siteUrl(), fail: simulateFailure });
  if (!r.ok) {
    revalidateOrg();
    return { ok: false, message: r.error };
  }
  if (r.kind === "redirect") return { ok: true, message: "Ouverture de la page de paiement…", url: r.url };
  const sub = await getRepo().getSubscription(organizationId);
  await audit({ actorId: acc.profile.id, action: "subscription.pay", targetType: "organization", targetId: organizationId, summary: `Abonnement ${PRO_PLANS[plan].label} payé · ${money(PRO_PLANS[plan].price)}`, details: { plan } });
  revalidateOrg();
  return { ok: true, message: sub ? `Paiement reçu. Ta fiche est en ligne jusqu’au ${new Date(sub.currentPeriodEnd + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.` : "Paiement reçu." };
}

export async function changePlanAction(organizationId: string, plan: string): Promise<{ ok: boolean; message: string; url?: string }> {
  const acc = await orgAccess(organizationId, "subscription.manage_own");
  if (!acc) return { ok: false, message: "Tu ne peux pas gérer cet abonnement." };
  if (!isProPlan(plan)) return { ok: false, message: "Formule inconnue." };
  const repo = getRepo();
  if (!(await repo.getSubscription(organizationId))) return paySubscriptionAction(organizationId, plan);
  // --- Vague 2 · paiements --- : le nouveau montant est appliqué chez le prestataire à la prochaine échéance
  const changed = await changeProPlan(organizationId, plan).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : "Changement refusé." }));
  if (!changed.ok) return { ok: false, message: changed.error ?? "Changement impossible." };
  await repo.updateSubscription(organizationId, { plan, monthlyPrice: PRO_PLANS[plan].price });
  await audit({ actorId: acc.profile.id, action: "subscription.change", targetType: "organization", targetId: organizationId, summary: `Formule ${PRO_PLANS[plan].label} choisie`, details: { plan } });
  revalidateOrg();
  return { ok: true, message: `Formule ${PRO_PLANS[plan].label} : appliquée dès maintenant, facturée à la prochaine échéance.` };
}

export async function setCancelAction(organizationId: string, cancel: boolean): Promise<{ ok: boolean; message: string }> {
  const acc = await orgAccess(organizationId, "subscription.manage_own");
  if (!acc) return { ok: false, message: "Tu ne peux pas gérer cet abonnement." };
  const repo = getRepo();
  if (!(await repo.getSubscription(organizationId))) return { ok: false, message: "Aucun abonnement en cours." };
  // --- Vague 2 · paiements --- : arrêt (ou reprise) programmé aussi chez le prestataire
  try {
    await setProCancelAtPeriodEnd(organizationId, cancel);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Le prestataire a refusé la demande." };
  }
  await repo.updateSubscription(organizationId, { cancelAtPeriodEnd: cancel });
  await audit({ actorId: acc.profile.id, action: "subscription.cancel", targetType: "organization", targetId: organizationId, summary: cancel ? "Arrêt de l’abonnement programmé à l’échéance" : "Abonnement repris" });
  revalidateOrg();
  return { ok: true, message: cancel ? "C’est noté : ta fiche reste en ligne jusqu’à l’échéance, puis s’arrête." : "Ton abonnement continue." };
}
