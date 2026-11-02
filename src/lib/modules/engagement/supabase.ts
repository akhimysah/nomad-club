/**
 * Implémentation « réelle » de EngagementRepo : Postgres via Supabase, avec la session de la personne (RLS).
 * Les opérations sensibles passent par les fonctions SQL de 0006_engagement.sql :
 * purchase_product_simulated, my_referral_code, claim_referral, respond_deal, business_leaderboard.
 * Fichiers : bucket privé « ressources », URL signées valables 60 secondes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "../../supabase/server";
import type { EngagementRepo } from "./repo";
import type {
  Deal,
  DealView,
  EngagementPrefs,
  EngagementSettings,
  PointsEntry,
  Product,
  ProductFile,
  ProductView,
  Purchase,
  PurchaseView,
  Referral,
  ReferralReward,
  ReferralView,
  RewardGrant,
  WidgetPref,
} from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numN = (v: unknown): number | null => (v == null ? null : Number(v));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
const db = (): Promise<SupabaseClient> => supabaseServer();

export const BUCKET = "ressources";
const SIGNED_URL_SECONDS = 60;

const toSettings = (r: Row): EngagementSettings => ({
  dealPointsBase: num(r.deal_points_base),
  dealPointsPerThousand: num(r.deal_points_per_thousand),
  dealPointsBonusCap: num(r.deal_points_bonus_cap),
  simulatedPayments: Boolean(r.simulated_payments),
  updatedAt: str(r.updated_at),
});
const toPrefs = (r: Row): EngagementPrefs => ({
  profileId: str(r.profile_id),
  widgets: Array.isArray(r.widgets) ? (r.widgets as WidgetPref[]) : [],
  leaderboardOptOut: Boolean(r.leaderboard_opt_out),
  updatedAt: str(r.updated_at),
});
const toProduct = (r: Row): Product => ({
  id: str(r.id),
  slug: str(r.slug),
  title: str(r.title),
  subtitle: strN(r.subtitle),
  description: str(r.description),
  category: (r.category as Product["category"]) ?? "guide",
  coverImage: strN(r.cover_image),
  price: num(r.price),
  priceMember: num(r.price_member),
  previewText: strN(r.preview_text),
  pages: numN(r.pages),
  status: (r.status as Product["status"]) ?? "draft",
  createdAt: str(r.created_at),
  publishedAt: strN(r.published_at),
});
const toFile = (r: Row): ProductFile => ({
  id: str(r.id),
  productId: str(r.product_id),
  label: str(r.label),
  fileName: str(r.file_name),
  storagePath: strN(r.storage_path),
  sizeBytes: numN(r.size_bytes),
  isPreview: Boolean(r.is_preview),
  sortOrder: num(r.sort_order),
  createdAt: str(r.created_at),
});
const toPurchase = (r: Row): Purchase => ({
  id: str(r.id),
  productId: str(r.product_id),
  profileId: str(r.profile_id),
  amount: num(r.amount),
  method: r.method as Purchase["method"],
  status: r.status as Purchase["status"],
  paymentRef: strN(r.payment_ref),
  createdAt: str(r.created_at),
});
const toReferral = (r: Row): Referral => ({
  id: str(r.id),
  referrerId: str(r.referrer_id),
  referredId: str(r.referred_id),
  referredName: str(r.referred_name),
  code: str(r.code),
  status: r.status as Referral["status"],
  createdAt: str(r.created_at),
  convertedAt: strN(r.converted_at),
});
const toReward = (r: Row): ReferralReward => ({
  id: str(r.id),
  kind: r.kind as ReferralReward["kind"],
  label: str(r.label),
  description: strN(r.description),
  points: num(r.points),
  active: Boolean(r.active),
  sortOrder: num(r.sort_order),
});
const toGrant = (r: Row): RewardGrant => ({
  id: str(r.id),
  referralId: str(r.referral_id),
  rewardId: strN(r.reward_id),
  beneficiaryId: str(r.beneficiary_id),
  kind: r.kind as RewardGrant["kind"],
  label: str(r.label),
  points: num(r.points),
  status: r.status as RewardGrant["status"],
  createdAt: str(r.created_at),
  deliveredAt: strN(r.delivered_at),
});
const toDeal = (r: Row): Deal => ({
  id: str(r.id),
  declaredBy: str(r.declared_by),
  partnerId: str(r.partner_id),
  nature: str(r.nature),
  category: r.category as Deal["category"],
  amount: numN(r.amount),
  dealDate: str(r.deal_date),
  note: strN(r.note),
  status: r.status as Deal["status"],
  pointsEach: num(r.points_each),
  createdAt: str(r.created_at),
  respondedAt: strN(r.responded_at),
});
const toPoints = (r: Row): PointsEntry => ({
  id: str(r.id),
  profileId: str(r.profile_id),
  points: num(r.points),
  source: r.source as PointsEntry["source"],
  refId: strN(r.ref_id),
  label: str(r.label),
  createdAt: str(r.created_at),
});

/** Noms des profils visibles (RLS : le cercle se voit, l'admin voit tout). */
async function names(c: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const rows = check(await c.from("profiles").select("id, first_name, last_name").in("id", uniq)) as Row[];
  return new Map(rows.map((r) => [str(r.id), [str(r.first_name), str(r.last_name)].filter(Boolean).join(" ")]));
}

async function withFiles(c: SupabaseClient, rows: Row[]): Promise<ProductView[]> {
  const products = rows.map(toProduct);
  const ids = products.map((p) => p.id);
  if (!ids.length) return [];
  const [files, sales] = await Promise.all([
    c.from("product_files").select("*").in("product_id", ids).order("sort_order"),
    c.from("purchases").select("product_id").in("product_id", ids).eq("status", "paid"),
  ]);
  const fileRows = (check(files) as Row[]).map(toFile);
  const saleRows = (sales.data as Row[] | null) ?? []; // une membre ne voit que ses achats : ventes exactes pour l'admin
  return products.map((p) => ({ ...p, files: fileRows.filter((f) => f.productId === p.id), sales: saleRows.filter((s) => str(s.product_id) === p.id).length }));
}

export const supabaseEngagementRepo: EngagementRepo = {
  async getEngagementSettings() {
    const c = await db();
    const r = check(await c.from("engagement_settings").select("*").eq("id", 1).maybeSingle()) as Row | null;
    return toSettings(r ?? {});
  },
  async updateEngagementSettings(patch, actorId) {
    const c = await db();
    const row: Row = { updated_at: new Date().toISOString(), updated_by: actorId };
    if (patch.dealPointsBase !== undefined) row.deal_points_base = patch.dealPointsBase;
    if (patch.dealPointsPerThousand !== undefined) row.deal_points_per_thousand = patch.dealPointsPerThousand;
    if (patch.dealPointsBonusCap !== undefined) row.deal_points_bonus_cap = patch.dealPointsBonusCap;
    if (patch.simulatedPayments !== undefined) row.simulated_payments = patch.simulatedPayments;
    return toSettings(check(await c.from("engagement_settings").update(row).eq("id", 1).select("*").single()) as Row);
  },
  async getEngagementPrefs(profileId) {
    const c = await db();
    const r = check(await c.from("engagement_prefs").select("*").eq("profile_id", profileId).maybeSingle()) as Row | null;
    return r ? toPrefs(r) : null;
  },
  async saveEngagementPrefs(profileId, patch) {
    const c = await db();
    const row: Row = { profile_id: profileId, updated_at: new Date().toISOString() };
    if (patch.widgets) row.widgets = patch.widgets;
    if (patch.leaderboardOptOut !== undefined) row.leaderboard_opt_out = patch.leaderboardOptOut;
    return toPrefs(check(await c.from("engagement_prefs").upsert(row, { onConflict: "profile_id" }).select("*").single()) as Row);
  },

  async listProducts(opts) {
    const c = await db();
    const status = opts?.status ?? "published";
    let q = c.from("products").select("*").order("published_at", { ascending: false, nullsFirst: true });
    if (status !== "all") q = q.eq("status", status);
    return withFiles(c, check(await q) as Row[]);
  },
  async getProduct(by) {
    const c = await db();
    let q = c.from("products").select("*");
    q = by.id ? q.eq("id", by.id) : q.eq("slug", by.slug ?? "");
    const r = check(await q.maybeSingle()) as Row | null;
    return r ? ((await withFiles(c, [r]))[0] ?? null) : null;
  },
  async saveProduct(input, id, actorId) {
    const c = await db();
    const row: Row = {
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle,
      description: input.description,
      category: input.category,
      cover_image: input.coverImage,
      price: input.price,
      price_member: input.priceMember,
      preview_text: input.previewText,
      pages: input.pages,
    };
    const res = id
      ? await c.from("products").update(row).eq("id", id).select("*").single()
      : await c.from("products").insert({ ...row, created_by: actorId }).select("*").single();
    return toProduct(check(res) as Row);
  },
  async setProductStatus(id, status) {
    const c = await db();
    const row: Row = { status };
    if (status === "published") {
      const cur = check(await c.from("products").select("published_at").eq("id", id).single()) as Row;
      if (!cur.published_at) row.published_at = new Date().toISOString();
    }
    return toProduct(check(await c.from("products").update(row).eq("id", id).select("*").single()) as Row);
  },
  async addProductFile(input) {
    const c = await db();
    let storagePath: string | null = null;
    if (input.bytes) {
      storagePath = `${input.productId}/${Date.now()}-${input.fileName}`;
      const up = await c.storage.from(BUCKET).upload(storagePath, input.bytes, { contentType: input.contentType, upsert: false });
      if (up.error) throw new Error(up.error.message);
    }
    const count = check(await c.from("product_files").select("id").eq("product_id", input.productId)) as Row[];
    const row = {
      product_id: input.productId,
      label: input.label,
      file_name: input.fileName,
      storage_path: storagePath,
      size_bytes: input.bytes ? input.bytes.byteLength : null,
      is_preview: input.isPreview,
      sort_order: count.length,
    };
    return toFile(check(await c.from("product_files").insert(row).select("*").single()) as Row);
  },
  async removeProductFile(fileId) {
    const c = await db();
    const f = check(await c.from("product_files").select("storage_path").eq("id", fileId).maybeSingle()) as Row | null;
    if (f?.storage_path) await c.storage.from(BUCKET).remove([str(f.storage_path)]);
    check(await c.from("product_files").delete().eq("id", fileId));
  },
  async getProductFile(fileId) {
    const c = await db();
    const r = check(await c.from("product_files").select("*").eq("id", fileId).maybeSingle()) as Row | null;
    return r ? toFile(r) : null;
  },
  async fileDelivery(file) {
    if (!file.storagePath) return { kind: "generated" };
    const c = await db();
    const res = await c.storage.from(BUCKET).createSignedUrl(file.storagePath, SIGNED_URL_SECONDS, { download: file.fileName });
    if (res.error || !res.data) throw new Error(res.error?.message ?? "URL signée indisponible.");
    return { kind: "url", url: res.data.signedUrl };
  },
  async recordPurchase(input) {
    // --- Vague 2 · paiements --- : paiement réel confirmé par le webhook (pas de session) → clé service, idempotent.
    // (ressource gratuite : même chemin, le prix nul a été vérifié côté serveur par buyProductAction)
    if (input.method === "card" || input.method === "transfer" || (input.method === "free" && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      const w = supabaseAdmin();
      const find = async () =>
        check(await w.from("purchases").select("*").eq("product_id", input.productId).eq("profile_id", input.profileId).eq("status", "paid").maybeSingle()) as Row | null;
      const existing = await find();
      if (existing) return toPurchase(existing);
      const res = await w
        .from("purchases")
        .insert({ product_id: input.productId, profile_id: input.profileId, amount: input.amount, method: input.method, payment_ref: input.paymentRef })
        .select("*")
        .single();
      if (res.error) {
        const again = await find(); // deux confirmations simultanées : l'index unique garde un seul achat
        if (again) return toPurchase(again);
        throw new Error(res.error.message);
      }
      return toPurchase(res.data as Row);
    }
    // Paiement simulé : la fonction SQL recalcule le prix membre et refuse si le paiement simulé est coupé.
    const c = await db();
    const r = check(await c.rpc("purchase_product_simulated", { p_product: input.productId })) as Row;
    return toPurchase(r);
  },
  async listPurchases(opts) {
    const c = await db();
    let q = c.from("purchases").select("*, product:products(*)").order("created_at", { ascending: false });
    if (opts?.profileId) q = q.eq("profile_id", opts.profileId);
    const rows = check(await q) as Row[];
    const n = await names(c, rows.map((r) => str(r.profile_id)));
    return rows
      .filter((r) => r.product)
      .map((r): PurchaseView => ({ ...toPurchase(r), product: toProduct(r.product as Row), buyerName: n.get(str(r.profile_id)) ?? "Membre" }));
  },
  async hasPurchased(profileId, productId) {
    const c = await db();
    const rows = check(await c.from("purchases").select("id").eq("profile_id", profileId).eq("product_id", productId).eq("status", "paid")) as Row[];
    return rows.length > 0;
  },

  async getReferralCode() {
    const c = await db();
    return str(check(await c.rpc("my_referral_code")));
  },
  async claimReferral(_profileId, code) {
    const c = await db();
    const r = check(await c.rpc("claim_referral", { p_code: code })) as Row | null;
    return r && r.id ? toReferral(r) : null;
  },
  async listReferrals(opts) {
    const c = await db();
    let q = c.from("referrals").select("*").order("created_at", { ascending: false });
    if (opts?.referrerId) q = q.eq("referrer_id", opts.referrerId);
    const refs = (check(await q) as Row[]).map(toReferral);
    if (!refs.length) return [];
    const [grants, n] = await Promise.all([
      c.from("referral_reward_grants").select("*").in("referral_id", refs.map((r) => r.id)),
      names(c, refs.map((r) => r.referrerId)),
    ]);
    const gs = (check(grants) as Row[]).map(toGrant);
    return refs.map((r): ReferralView => ({ ...r, referrerName: n.get(r.referrerId) ?? "Membre", grants: gs.filter((x) => x.referralId === r.id) }));
  },
  async listRewards(opts) {
    const c = await db();
    let q = c.from("referral_rewards").select("*").order("sort_order");
    if (!opts?.all) q = q.eq("active", true);
    return (check(await q) as Row[]).map(toReward);
  },
  async saveReward(input, id) {
    const c = await db();
    const row = { kind: input.kind, label: input.label, description: input.description, points: input.points, active: input.active };
    const res = id ? await c.from("referral_rewards").update(row).eq("id", id).select("*").single() : await c.from("referral_rewards").insert(row).select("*").single();
    return toReward(check(res) as Row);
  },
  async listGrants(opts) {
    const c = await db();
    let q = c.from("referral_reward_grants").select("*").order("created_at", { ascending: false });
    if (opts?.beneficiaryId) q = q.eq("beneficiary_id", opts.beneficiaryId);
    return (check(await q) as Row[]).map(toGrant);
  },
  async deliverGrant(id, actorId) {
    const c = await db();
    const r = check(
      await c.from("referral_reward_grants").update({ status: "delivered", delivered_at: new Date().toISOString(), delivered_by: actorId }).eq("id", id).select("*").maybeSingle(),
    ) as Row | null;
    return r ? toGrant(r) : null;
  },

  async declareDeal(input) {
    const c = await db();
    const row = {
      declared_by: input.declaredBy,
      partner_id: input.partnerId,
      nature: input.nature,
      category: input.category,
      amount: input.amount,
      deal_date: input.dealDate,
      note: input.note,
    };
    return toDeal(check(await c.from("business_deals").insert(row).select("*").single()) as Row);
  },
  async respondDeal(dealId, _profileId, accept) {
    const c = await db();
    const r = check(await c.rpc("respond_deal", { p_deal: dealId, p_accept: accept })) as Row | null;
    return r && r.id ? toDeal(r) : null;
  },
  async withdrawDeal(dealId, profileId) {
    const c = await db();
    const rows = check(await c.from("business_deals").delete().eq("id", dealId).eq("declared_by", profileId).eq("status", "pending").select("id")) as Row[];
    return rows.length > 0;
  },
  async listDeals(opts) {
    const c = await db();
    let q = c.from("business_deals").select("*").order("created_at", { ascending: false });
    if (opts?.profileId) q = q.or(`declared_by.eq.${opts.profileId},partner_id.eq.${opts.profileId}`);
    const deals = (check(await q) as Row[]).map(toDeal);
    const n = await names(c, deals.flatMap((d) => [d.declaredBy, d.partnerId]));
    return deals.map((d): DealView => ({ ...d, declaredByName: n.get(d.declaredBy) ?? "Membre", partnerName: n.get(d.partnerId) ?? "Membre" }));
  },
  async listPoints(profileId) {
    const c = await db();
    return (check(await c.from("points_ledger").select("*").eq("profile_id", profileId).order("created_at", { ascending: false })) as Row[]).map(toPoints);
  },
  async leaderboard(limit = 20) {
    const c = await db();
    const rows = check(await c.rpc("business_leaderboard", { p_limit: limit })) as Row[];
    return rows.map((r) => ({ profileId: str(r.profile_id), name: [str(r.first_name), str(r.last_name)].filter(Boolean).join(" "), points: num(r.points), deals: num(r.deals) }));
  },
};
