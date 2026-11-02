"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkCapability } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getRepo } from "@/lib/data";
import { slugify } from "@/lib/domain/events";
import type { ProductCategory, ProductStatus, RewardKind } from "@/lib/modules/engagement/types";

export type AdminResult = { ok: true; message: string } | { ok: false; error: string };
export type ProductFormState = { ok: boolean; error?: string; field?: string } | null;

const revalidateAll = () => revalidatePath("/", "layout");

/* ---------- boutique ---------- */

const CATS: [ProductCategory, ...ProductCategory[]] = ["guide", "modele", "formation", "carnet"];
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((x) => x || null);

const productSchema = z
  .object({
    title: z.string().trim().min(2, "Un titre, s’il te plaît.").max(140),
    slug: z
      .string()
      .trim()
      .max(80)
      .transform((x) => slugify(x)),
    subtitle: optText(200),
    description: z.string().trim().max(6000),
    category: z.enum(CATS),
    coverImage: optText(300).refine((x) => !x || x.startsWith("/") || /^https:\/\//.test(x), "Une adresse d’image commençant par / ou https://"),
    price: z.coerce.number().min(0, "Prix positif.").max(100000),
    priceMember: z.coerce.number().min(0, "Prix positif.").max(100000),
    previewText: optText(3000),
    pages: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(5000)])
      .transform((x) => (x === "" ? null : x)),
  })
  .refine((x) => x.priceMember <= x.price, { message: "Le prix membre doit être inférieur ou égal au prix public.", path: ["priceMember"] });

/** Créer ou modifier une ressource (formulaire de l'espace fondatrices). */
export async function saveProductAction(_prev: ProductFormState, form: FormData): Promise<ProductFormState> {
  const v = await checkCapability("shop.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  const id = String(form.get("id") ?? "") || null;
  const raw = Object.fromEntries(["title", "slug", "subtitle", "description", "category", "coverImage", "price", "priceMember", "previewText", "pages"].map((k) => [k, String(form.get(k) ?? "")]));
  if (!raw.slug) raw.slug = raw.title;
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  if (!parsed.data.slug) return { ok: false, error: "Adresse invalide.", field: "slug" };
  let savedId: string;
  try {
    const p = await getRepo().saveProduct(parsed.data, id, v.profile.id);
    savedId = p.id;
    await audit({ actorId: v.profile.id, action: id ? "product.update" : "product.create", targetType: "product", targetId: p.id, summary: `${id ? "Ressource modifiée" : "Ressource créée"} : « ${p.title} »` });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.length < 140 ? e.message : "Enregistrement impossible." };
  }
  revalidateAll();
  redirect(`/fondatrices/boutique/${savedId}?ok=1`);
}

export async function setProductStatusAction(id: string, status: ProductStatus): Promise<AdminResult> {
  const v = await checkCapability("shop.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  if (!["draft", "published", "archived"].includes(status)) return { ok: false, error: "Statut inconnu." };
  const repo = getRepo();
  const cur = await repo.getProduct({ id });
  if (!cur) return { ok: false, error: "Ressource introuvable." };
  if (status === "published" && !cur.files.some((f) => !f.isPreview)) return { ok: false, error: "Ajoute au moins un fichier avant de publier." };
  const p = await repo.setProductStatus(id, status);
  if (status === "published") await audit({ actorId: v.profile.id, action: "product.publish", targetType: "product", targetId: p.id, summary: `Ressource publiée : « ${p.title} »` });
  else await audit({ actorId: v.profile.id, action: "product.update", targetType: "product", targetId: p.id, summary: `« ${p.title} » ${status === "archived" ? "retirée de la boutique" : "repassée en brouillon"}` });
  revalidateAll();
  return { ok: true, message: status === "published" ? "Publiée dans la boutique" : status === "archived" ? "Retirée de la boutique" : "Repassée en brouillon" };
}

const MAX_FILE = 25 * 1024 * 1024;

/** Ajoute un fichier à une ressource (PDF, ZIP…). Sans fichier envoyé en démo : PDF d'exemple généré. */
export async function addProductFileAction(form: FormData): Promise<AdminResult> {
  const v = await checkCapability("shop.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  const productId = String(form.get("productId") ?? "");
  const label = String(form.get("label") ?? "").trim().slice(0, 140);
  const isPreview = form.get("isPreview") === "on";
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!label) return { ok: false, error: "Donne un nom au fichier." };
  if (!hasFile && v.mode === "real") return { ok: false, error: "Choisis un fichier à envoyer." };
  if (hasFile && file.size > MAX_FILE) return { ok: false, error: "25 Mo au plus." };
  const product = await getRepo().getProduct({ id: productId });
  if (!product) return { ok: false, error: "Ressource introuvable." };
  const base = hasFile ? file.name : `${slugify(label) || "fichier"}.pdf`;
  const fileName = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "fichier.pdf";
  try {
    await getRepo().addProductFile({
      productId,
      label,
      fileName,
      isPreview,
      bytes: hasFile ? new Uint8Array(await file.arrayBuffer()) : null,
      contentType: hasFile ? file.type || "application/octet-stream" : "application/pdf",
    });
    await audit({ actorId: v.profile.id, action: "product.update", targetType: "product", targetId: productId, summary: `Fichier ajouté à « ${product.title} » : ${label}` });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.length < 140 ? e.message : "Envoi impossible." };
  }
  revalidateAll();
  return { ok: true, message: "Fichier ajouté" };
}

export async function removeProductFileAction(fileId: string): Promise<AdminResult> {
  const v = await checkCapability("shop.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  await getRepo().removeProductFile(String(fileId));
  revalidateAll();
  return { ok: true, message: "Fichier retiré" };
}

/* ---------- parrainage ---------- */

const KINDS: [RewardKind, ...RewardKind[]] = ["free_month", "invitation", "points", "other"];
const rewardSchema = z.object({
  kind: z.enum(KINDS),
  label: z.string().trim().min(2, "Un nom pour la récompense.").max(120),
  description: optText(400),
  points: z.coerce.number().int().min(0).max(10000),
  active: z.boolean(),
});

export async function saveRewardAction(input: { id: string | null; kind: string; label: string; description: string; points: string | number; active: boolean }): Promise<AdminResult> {
  const v = await checkCapability("referral.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = { ...parsed.data, points: parsed.data.kind === "points" ? parsed.data.points : 0 };
  if (data.kind === "points" && data.points <= 0) return { ok: false, error: "Indique un nombre de points." };
  const r = await getRepo().saveReward(data, input.id);
  await audit({ actorId: v.profile.id, action: "referral.reward_config", targetType: "referral", targetId: r.id, summary: `Récompense de parrainage ${input.id ? "modifiée" : "créée"} : ${r.label}${r.active ? "" : " (inactive)"}` });
  revalidateAll();
  return { ok: true, message: input.id ? "Récompense mise à jour" : "Récompense ajoutée" };
}

export async function deliverGrantAction(id: string): Promise<AdminResult> {
  const v = await checkCapability("referral.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  const g = await getRepo().deliverGrant(String(id), v.profile.id);
  if (!g) return { ok: false, error: "Récompense introuvable." };
  await audit({ actorId: v.profile.id, action: "referral.reward_deliver", targetType: "referral", targetId: g.id, summary: `Récompense remise : ${g.label}` });
  revalidateAll();
  return { ok: true, message: "Marquée comme remise" };
}

/* ---------- Espace Business et paiement simulé ---------- */

const settingsSchema = z.object({
  dealPointsBase: z.coerce.number().int().min(0).max(1000),
  dealPointsPerThousand: z.coerce.number().int().min(0).max(1000),
  dealPointsBonusCap: z.coerce.number().int().min(0).max(10000),
});

export async function saveBusinessSettingsAction(input: { dealPointsBase: string | number; dealPointsPerThousand: string | number; dealPointsBonusCap: string | number }): Promise<AdminResult> {
  const v = await checkCapability("business.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Des nombres entiers positifs, s’il te plaît." };
  const s = await getRepo().updateEngagementSettings(parsed.data, v.profile.id);
  await audit({
    actorId: v.profile.id,
    action: "deal.settings",
    targetType: "settings",
    targetId: null,
    summary: `Barème Business : ${s.dealPointsBase} points par deal, +${s.dealPointsPerThousand} par tranche de 1 000 $ (bonus max ${s.dealPointsBonusCap})`,
    details: parsed.data,
  });
  revalidateAll();
  return { ok: true, message: "Barème enregistré (pour les prochains deals)" };
}

export async function setSimulatedPaymentsAction(enabled: boolean): Promise<AdminResult> {
  const v = await checkCapability("shop.manage");
  if (!v) return { ok: false, error: "Accès réservé." };
  await getRepo().updateEngagementSettings({ simulatedPayments: Boolean(enabled) }, v.profile.id);
  await audit({ actorId: v.profile.id, action: "product.update", targetType: "settings", targetId: null, summary: `Paiement simulé de la boutique ${enabled ? "activé" : "coupé"}` });
  revalidateAll();
  return { ok: true, message: enabled ? "Paiement simulé activé" : "Paiement simulé coupé" };
}
