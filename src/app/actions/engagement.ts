"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName, money } from "@/lib/format";
import { payForProduct } from "@/lib/modules/engagement/billing";
import { dealAnswered, dealDeclared, purchaseCompleted } from "@/lib/modules/engagement/notifications";
import type { DealCategory, WidgetPref } from "@/lib/modules/engagement/types";
import { sanitizeWidgetPrefs } from "@/lib/modules/engagement/widgets";

export type EngagementResult = { ok: true; message: string } | { ok: false; error: string };

const revalidate = () => revalidatePath("/espace", "layout");

/* ---------- dashboard ---------- */

/** Enregistre l'ordre et l'activation des widgets de l'accueil. */
export async function saveWidgetPrefsAction(widgets: WidgetPref[]): Promise<EngagementResult> {
  const v = await checkCapability("dashboard.customize");
  if (!v) return { ok: false, error: "Réservé aux membres." };
  const clean = sanitizeWidgetPrefs(widgets);
  if (!clean) return { ok: false, error: "Préférences invalides." };
  await getRepo().saveEngagementPrefs(v.profile.id, { widgets: clean });
  revalidatePath("/espace");
  return { ok: true, message: "Accueil enregistré" };
}

/* ---------- boutique ---------- */

/** Achat d'une ressource : paiement (simulé, billing.ts), accès immédiat, notification. */
export async function buyProductAction(productId: string): Promise<EngagementResult & { already?: boolean }> {
  const v = await checkCapability("shop.buy");
  if (!v) return { ok: false, error: "La boutique est réservée aux membres." };
  if (typeof productId !== "string" || productId.length > 80) return { ok: false, error: "Ressource introuvable." };
  const repo = getRepo();
  const product = await repo.getProduct({ id: productId });
  if (!product || product.status !== "published") return { ok: false, error: "Cette ressource n’est plus disponible." };
  if (await repo.hasPurchased(v.profile.id, product.id)) return { ok: true, message: "Tu as déjà cette ressource.", already: true };
  const settings = await repo.getEngagementSettings();
  const charge = await payForProduct(product, v.profile, { simulatedAllowed: v.mode === "demo" || settings.simulatedPayments });
  if (!charge.ok) return { ok: false, error: charge.error };
  try {
    const p = await repo.recordPurchase({ productId: product.id, profileId: v.profile.id, amount: charge.amount, method: charge.method, paymentRef: charge.reference });
    await purchaseCompleted(v.profile.id, product, p.amount);
  } catch (e) {
    console.error("[boutique]", e instanceof Error ? e.message : e);
    return { ok: false, error: "L’achat n’a pas abouti. Réessaie dans un instant." };
  }
  revalidate();
  return { ok: true, message: charge.amount > 0 ? `Paiement accepté · ${money(charge.amount)}` : "Ajouté à tes ressources" };
}

/* ---------- Espace Business ---------- */

const CATEGORIES: [DealCategory, ...DealCategory[]] = ["prestation", "vente", "partenariat", "recommandation", "autre"];

const dealSchema = z.object({
  partnerId: z.string().min(1, "Choisis la membre avec qui tu as conclu ce deal.").max(80),
  nature: z.string().trim().min(3, "Décris le deal en quelques mots.").max(200, "200 caractères au plus."),
  category: z.enum(CATEGORIES),
  amount: z
    .union([z.literal(""), z.coerce.number().min(0, "Montant positif, s’il te plaît.").max(10_000_000, "Montant trop élevé.")])
    .transform((x) => (x === "" ? null : Math.round(x))),
  dealDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis une date."),
  note: z
    .string()
    .trim()
    .max(600)
    .transform((x) => x || null),
});

export type DealFormInput = { partnerId: string; nature: string; category: string; amount: string; dealDate: string; note: string };

export async function declareDealAction(input: DealFormInput): Promise<EngagementResult & { field?: string }> {
  const v = await checkCapability("business.use");
  if (!v) return { ok: false, error: "Réservé aux membres." };
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const d = parsed.data;
  if (d.dealDate > today()) return { ok: false, error: "Le deal doit déjà avoir eu lieu.", field: "dealDate" };
  if (d.partnerId === v.profile.id) return { ok: false, error: "Choisis une autre membre.", field: "partnerId" };
  const repo = getRepo();
  const partner = await repo.getProfile(d.partnerId);
  if (!partner) return { ok: false, error: "Membre introuvable.", field: "partnerId" };
  try {
    const deal = await repo.declareDeal({ declaredBy: v.profile.id, partnerId: d.partnerId, nature: d.nature, category: d.category, amount: d.amount, dealDate: d.dealDate, note: d.note });
    await dealDeclared(deal, fullName(v.profile));
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.length < 120 ? e.message : "La déclaration n’a pas abouti." };
  }
  revalidate();
  return { ok: true, message: `Deal envoyé à ${partner.firstName} pour confirmation` };
}

export async function respondDealAction(dealId: string, accept: boolean): Promise<EngagementResult> {
  const v = await checkCapability("business.use");
  if (!v) return { ok: false, error: "Réservé aux membres." };
  const repo = getRepo();
  let deal;
  try {
    deal = await repo.respondDeal(String(dealId), v.profile.id, Boolean(accept));
  } catch {
    deal = null;
  }
  if (!deal) return { ok: false, error: "Ce deal ne t’attend pas." };
  await dealAnswered(deal, fullName(v.profile));
  revalidate();
  return { ok: true, message: deal.status === "confirmed" ? `Deal confirmé · +${deal.pointsEach} points` : "Deal refusé" };
}

export async function withdrawDealAction(dealId: string): Promise<EngagementResult> {
  const v = await checkCapability("business.use");
  if (!v) return { ok: false, error: "Réservé aux membres." };
  const ok = await getRepo().withdrawDeal(String(dealId), v.profile.id);
  revalidate();
  return ok ? { ok: true, message: "Déclaration retirée" } : { ok: false, error: "Ce deal ne peut plus être retiré." };
}

export async function setLeaderboardOptOutAction(optOut: boolean): Promise<EngagementResult> {
  const v = await checkCapability("business.use");
  if (!v) return { ok: false, error: "Réservé aux membres." };
  await getRepo().saveEngagementPrefs(v.profile.id, { leaderboardOptOut: Boolean(optOut) });
  revalidate();
  return { ok: true, message: optOut ? "Tu n’apparais plus dans le classement" : "Tu apparais dans le classement" };
}
