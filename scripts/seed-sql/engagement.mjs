// Lot 4 (engagement) : lignes SQL des données d'exemple, à partir de createSeed().engagement.
// Utilisé par scripts/seed-sql.mjs (supabase/seed.sql) et par scripts/test-sql/engagement.mjs.

const q = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;

/** @param {{ engagement: any }} s données de createSeed() ; @param {(id: string) => string} uuid */
export function engagementSeedLines(s, uuid) {
  const e = s.engagement;
  const u = (id) => (id == null ? "null" : q(uuid(id)));
  const lines = [];
  const insert = (table, cols, rows, conflict = "") => {
    if (!rows.length) return;
    lines.push(`insert into public.${table} (${cols.join(", ")}) values`);
    lines.push(rows.map((r) => `  (${r.join(", ")})`).join(",\n") + (conflict ? `\n${conflict};` : ";"));
    lines.push("");
  };

  lines.push("-- Engagement : boutique, parrainage, Espace Business, préférences (0006_engagement.sql).");
  lines.push(
    `update public.engagement_settings set deal_points_base = ${e.settings.dealPointsBase}, deal_points_per_thousand = ${e.settings.dealPointsPerThousand}, deal_points_bonus_cap = ${e.settings.dealPointsBonusCap}, simulated_payments = ${q(e.settings.simulatedPayments)} where id = 1;`,
  );
  lines.push("");
  insert(
    "products",
    ["id", "slug", "title", "subtitle", "description", "category", "cover_image", "price", "price_member", "preview_text", "pages", "status", "created_at", "published_at"],
    e.products.map((p) => [u(p.id), q(p.slug), q(p.title), q(p.subtitle), q(p.description), q(p.category), q(p.coverImage), p.price, p.priceMember, q(p.previewText), q(p.pages), q(p.status), q(p.createdAt), q(p.publishedAt)]),
    "on conflict (id) do nothing",
  );
  insert(
    "product_files",
    ["id", "product_id", "label", "file_name", "storage_path", "size_bytes", "is_preview", "sort_order", "created_at"],
    e.productFiles.map((f) => [u(f.id), u(f.productId), q(f.label), q(f.fileName), q(f.storagePath), q(f.sizeBytes), q(f.isPreview), f.sortOrder, q(f.createdAt)]),
    "on conflict (id) do nothing",
  );
  insert(
    "purchases",
    ["id", "product_id", "profile_id", "amount", "method", "status", "payment_ref", "created_at"],
    e.purchases.map((p) => [u(p.id), u(p.productId), u(p.profileId), p.amount, q(p.method), q(p.status), q(p.paymentRef), q(p.createdAt)]),
    "on conflict (id) do nothing",
  );
  insert("referral_codes", ["profile_id", "code", "created_at"], e.referralCodes.map((c) => [u(c.profileId), q(c.code), q(c.createdAt)]), "on conflict do nothing");
  insert(
    "referrals",
    ["id", "referrer_id", "referred_id", "referred_name", "code", "status", "created_at", "converted_at"],
    e.referrals.map((r) => [u(r.id), u(r.referrerId), u(r.referredId), q(r.referredName), q(r.code), q(r.status), q(r.createdAt), q(r.convertedAt)]),
    "on conflict do nothing",
  );
  insert(
    "referral_rewards",
    ["id", "kind", "label", "description", "points", "active", "sort_order"],
    e.rewards.map((r) => [u(r.id), q(r.kind), q(r.label), q(r.description), r.points, q(r.active), r.sortOrder]),
    "on conflict (id) do nothing",
  );
  insert(
    "referral_reward_grants",
    ["id", "referral_id", "reward_id", "beneficiary_id", "kind", "label", "points", "status", "created_at", "delivered_at"],
    e.grants.map((g) => [u(g.id), u(g.referralId), u(g.rewardId), u(g.beneficiaryId), q(g.kind), q(g.label), g.points, q(g.status), q(g.createdAt), q(g.deliveredAt)]),
    "on conflict do nothing",
  );
  insert(
    "business_deals",
    ["id", "declared_by", "partner_id", "nature", "category", "amount", "deal_date", "note", "status", "points_each", "created_at", "responded_at"],
    e.deals.map((d) => [u(d.id), u(d.declaredBy), u(d.partnerId), q(d.nature), q(d.category), q(d.amount), q(d.dealDate), q(d.note), q(d.status), d.pointsEach, q(d.createdAt), q(d.respondedAt)]),
    "on conflict (id) do nothing",
  );
  insert(
    "points_ledger",
    ["id", "profile_id", "points", "source", "ref_id", "label", "created_at"],
    e.points.map((p) => [u(p.id), u(p.profileId), p.points, q(p.source), u(p.refId), q(p.label), q(p.createdAt)]),
    "on conflict (id) do nothing",
  );
  insert(
    "engagement_prefs",
    ["profile_id", "widgets", "leaderboard_opt_out", "updated_at"],
    e.prefs.map((p) => [u(p.profileId), json(p.widgets), q(p.leaderboardOptOut), q(p.updatedAt)]),
    "on conflict (profile_id) do nothing",
  );
  return lines;
}
