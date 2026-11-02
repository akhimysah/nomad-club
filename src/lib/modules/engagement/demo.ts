/**
 * Implémentation « démo » de EngagementRepo : données en mémoire (SeedData.engagement),
 * mêmes règles que la base (0006_engagement.sql) : achat unique, deal confirmé par l'autre membre,
 * récompenses de parrainage attribuées quand la filleule devient membre.
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../../clock";
import { fullName } from "../../format";
import { inCircle } from "../../permissions";
import type { SeedData } from "../../seed";
import type { AppNotification, NotificationType } from "../../types";
import { dealPoints } from "./points";
import type { EngagementRepo } from "./repo";
import { createEngagementSeed } from "./seed";
import type { DealView, EngagementSeed, Product, ProductView, PurchaseView, Referral, ReferralView } from "./types";

type UploadStore = Map<string, { bytes: Uint8Array; contentType: string }>;
const g = globalThis as typeof globalThis & { __nomadEngagementUploads?: UploadStore };
const uploads = (): UploadStore => (g.__nomadEngagementUploads ??= new Map());

const clone = <T>(v: T): T => structuredClone(v);

export function createDemoEngagementRepo(getDb: () => SeedData): EngagementRepo {
  const db = () => {
    const d = getDb();
    // jeu en mémoire créé avant le Lot 4 (rechargement à chaud) : on complète
    if (!d.engagement) d.engagement = createEngagementSeed();
    return d;
  };
  const e = (): EngagementSeed => db().engagement;
  const nameOf = (id: string) => {
    const p = db().profiles.find((x) => x.id === id);
    return p ? fullName(p) : "Membre";
  };

  /** Notification in-app (respecte les préférences, comme le déclencheur SQL). */
  const pushNotification = (recipientId: string, type: NotificationType, title: string, body: string, link: string) => {
    const d = db();
    if (d.notificationPrefs.some((p) => p.profileId === recipientId && p.type === type && !p.inApp)) return;
    const n: AppNotification = { id: randomUUID(), recipientId, type, title, body, link, readAt: null, createdAt: nowIso() };
    d.notifications.push(n);
  };

  /** Filleules devenues membres depuis la dernière lecture (en base : déclencheur referral_on_member). */
  const syncConversions = () => {
    const d = db();
    const en = d.engagement;
    for (const r of en.referrals) {
      if (r.status !== "signed_up") continue;
      const p = d.profiles.find((x) => x.id === r.referredId);
      if (!p || !p.roles.includes("member")) continue;
      const at = nowIso();
      r.status = "member";
      r.convertedAt = at;
      const labels: string[] = [];
      for (const w of en.rewards.filter((x) => x.active).sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (en.grants.some((x) => x.referralId === r.id && x.rewardId === w.id)) continue;
        const auto = w.kind === "points";
        en.grants.push({ id: randomUUID(), referralId: r.id, rewardId: w.id, beneficiaryId: r.referrerId, kind: w.kind, label: w.label, points: w.points, status: auto ? "delivered" : "granted", createdAt: at, deliveredAt: auto ? at : null });
        if (w.points > 0) en.points.push({ id: randomUUID(), profileId: r.referrerId, points: w.points, source: "referral", refId: r.id, label: `Parrainage · ${r.referredName}`, createdAt: at });
        labels.push(w.label);
      }
      pushNotification(r.referrerId, "referral_rewarded", "Ta filleule est devenue membre", `${r.referredName} a rejoint le club.${labels.length ? ` Ta récompense : ${labels.join(", ")}.` : ""}`, "/espace/parrainage");
    }
  };

  const productView = (p: Product, withFiles = true): ProductView => {
    const en = e();
    return {
      ...p,
      files: withFiles ? en.productFiles.filter((f) => f.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder) : [],
      sales: en.purchases.filter((x) => x.productId === p.id && x.status === "paid").length,
    };
  };

  const dealView = (x: EngagementSeed["deals"][number]): DealView => ({ ...x, declaredByName: nameOf(x.declaredBy), partnerName: nameOf(x.partnerId) });

  return {
    async getEngagementSettings() {
      return clone(e().settings);
    },
    async updateEngagementSettings(patch) {
      const en = e();
      en.settings = { ...en.settings, ...patch, updatedAt: nowIso() };
      return clone(en.settings);
    },
    async getEngagementPrefs(profileId) {
      const p = e().prefs.find((x) => x.profileId === profileId);
      return p ? clone(p) : null;
    },
    async saveEngagementPrefs(profileId, patch) {
      const en = e();
      let p = en.prefs.find((x) => x.profileId === profileId);
      if (!p) {
        p = { profileId, widgets: [], leaderboardOptOut: false, updatedAt: nowIso() };
        en.prefs.push(p);
      }
      if (patch.widgets) p.widgets = patch.widgets;
      if (patch.leaderboardOptOut !== undefined) p.leaderboardOptOut = patch.leaderboardOptOut;
      p.updatedAt = nowIso();
      return clone(p);
    },

    async listProducts(opts) {
      const status = opts?.status ?? "published";
      return clone(
        e()
          .products.filter((p) => status === "all" || p.status === status)
          .sort((a, b) => ((a.publishedAt ?? a.createdAt) < (b.publishedAt ?? b.createdAt) ? 1 : -1))
          .map((p) => productView(p)),
      );
    },
    async getProduct(by) {
      const p = e().products.find((x) => (by.id && x.id === by.id) || (by.slug && x.slug === by.slug));
      return p ? clone(productView(p)) : null;
    },
    async saveProduct(input, id) {
      const en = e();
      if (en.products.some((p) => p.slug === input.slug && p.id !== id)) throw new Error("Cette adresse (slug) est déjà prise.");
      if (id) {
        const p = en.products.find((x) => x.id === id);
        if (!p) throw new Error("Produit introuvable.");
        Object.assign(p, input);
        return clone(p);
      }
      const p: Product = { id: randomUUID(), ...input, status: "draft", createdAt: nowIso(), publishedAt: null };
      en.products.push(p);
      return clone(p);
    },
    async setProductStatus(id, status) {
      const p = e().products.find((x) => x.id === id);
      if (!p) throw new Error("Produit introuvable.");
      p.status = status;
      if (status === "published" && !p.publishedAt) p.publishedAt = nowIso();
      return clone(p);
    },
    async addProductFile(input) {
      const en = e();
      const f = {
        id: randomUUID(),
        productId: input.productId,
        label: input.label,
        fileName: input.fileName,
        storagePath: null,
        sizeBytes: input.bytes ? input.bytes.byteLength : null,
        isPreview: input.isPreview,
        sortOrder: en.productFiles.filter((x) => x.productId === input.productId).length,
        createdAt: nowIso(),
      };
      en.productFiles.push(f);
      if (input.bytes) uploads().set(f.id, { bytes: input.bytes, contentType: input.contentType });
      return clone(f);
    },
    async removeProductFile(fileId) {
      const en = e();
      en.productFiles = en.productFiles.filter((f) => f.id !== fileId);
      uploads().delete(fileId);
    },
    async getProductFile(fileId) {
      const f = e().productFiles.find((x) => x.id === fileId);
      return f ? clone(f) : null;
    },
    async fileDelivery(file) {
      const up = uploads().get(file.id);
      return up ? { kind: "bytes", bytes: up.bytes, contentType: up.contentType } : { kind: "generated" };
    },
    async recordPurchase(input) {
      const en = e();
      const existing = en.purchases.find((x) => x.productId === input.productId && x.profileId === input.profileId && x.status === "paid");
      if (existing) return clone(existing);
      const pu = { id: randomUUID(), ...input, status: "paid" as const, createdAt: nowIso() };
      en.purchases.push(pu);
      return clone(pu);
    },
    async listPurchases(opts) {
      const en = e();
      return clone(
        en.purchases
          .filter((x) => !opts?.profileId || x.profileId === opts.profileId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((x): PurchaseView | null => {
            const product = en.products.find((p) => p.id === x.productId);
            return product ? { ...x, product, buyerName: nameOf(x.profileId) } : null;
          })
          .filter((x): x is PurchaseView => !!x),
      );
    },
    async hasPurchased(profileId, productId) {
      return e().purchases.some((x) => x.profileId === profileId && x.productId === productId && x.status === "paid");
    },

    async getReferralCode(profileId) {
      const en = e();
      const found = en.referralCodes.find((c) => c.profileId === profileId);
      if (found) return found.code;
      const p = db().profiles.find((x) => x.id === profileId);
      const base =
        (p?.firstName ?? "NOMAD")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 10) || "NOMAD";
      const CH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      let code = "";
      do code = `${base.length >= 2 ? base : "NOMAD"}-${Array.from({ length: 4 }, () => CH[Math.floor(Math.random() * CH.length)]).join("")}`;
      while (en.referralCodes.some((c) => c.code === code));
      en.referralCodes.push({ profileId, code, createdAt: nowIso() });
      return code;
    },
    async claimReferral(profileId, code) {
      const en = e();
      const owner = en.referralCodes.find((c) => c.code === code.trim().toUpperCase());
      const me = db().profiles.find((x) => x.id === profileId);
      if (!owner || !me || owner.profileId === profileId || inCircle(me)) return null;
      if (en.referrals.some((r) => r.referredId === profileId)) return null;
      const r: Referral = {
        id: randomUUID(),
        referrerId: owner.profileId,
        referredId: profileId,
        referredName: [me.firstName, me.lastName ? me.lastName[0] + "." : ""].filter(Boolean).join(" ") || "Nouvelle inscrite",
        code: owner.code,
        status: "signed_up",
        createdAt: nowIso(),
        convertedAt: null,
      };
      en.referrals.push(r);
      pushNotification(owner.profileId, "referral_signup", "Une filleule s’est inscrite", `${r.referredName} s’est inscrite avec ton code. Ta récompense arrive dès qu’elle devient membre.`, "/espace/parrainage");
      return clone(r);
    },
    async listReferrals(opts) {
      syncConversions();
      const en = e();
      return clone(
        en.referrals
          .filter((r) => !opts?.referrerId || r.referrerId === opts.referrerId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((r): ReferralView => ({ ...r, referrerName: nameOf(r.referrerId), grants: en.grants.filter((x) => x.referralId === r.id) })),
      );
    },
    async listRewards(opts) {
      return clone(
        e()
          .rewards.filter((r) => opts?.all || r.active)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
    async saveReward(input, id) {
      const en = e();
      if (id) {
        const r = en.rewards.find((x) => x.id === id);
        if (!r) throw new Error("Récompense introuvable.");
        Object.assign(r, input);
        return clone(r);
      }
      const r = { id: randomUUID(), ...input, sortOrder: en.rewards.length };
      en.rewards.push(r);
      return clone(r);
    },
    async listGrants(opts) {
      syncConversions();
      return clone(
        e()
          .grants.filter((x) => !opts?.beneficiaryId || x.beneficiaryId === opts.beneficiaryId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      );
    },
    async deliverGrant(id) {
      const x = e().grants.find((y) => y.id === id);
      if (!x || x.status === "delivered") return x ? clone(x) : null;
      x.status = "delivered";
      x.deliveredAt = nowIso();
      return clone(x);
    },

    async declareDeal(input) {
      const d = db();
      const partner = d.profiles.find((p) => p.id === input.partnerId);
      if (!partner || !inCircle(partner) || input.partnerId === input.declaredBy) throw new Error("Choisis une autre membre du club.");
      const deal = { id: randomUUID(), ...input, status: "pending" as const, pointsEach: 0, createdAt: nowIso(), respondedAt: null };
      d.engagement.deals.push(deal);
      return clone(deal);
    },
    async respondDeal(dealId, profileId, accept) {
      const en = e();
      const deal = en.deals.find((x) => x.id === dealId && x.partnerId === profileId);
      if (!deal) return null;
      if (deal.status !== "pending") return clone(deal);
      deal.respondedAt = nowIso();
      if (accept) {
        deal.status = "confirmed";
        deal.pointsEach = dealPoints(en.settings, deal.amount);
        for (const who of [deal.declaredBy, deal.partnerId])
          en.points.push({ id: randomUUID(), profileId: who, points: deal.pointsEach, source: "deal", refId: deal.id, label: `Deal confirmé · ${deal.nature}`, createdAt: deal.respondedAt });
      } else deal.status = "refused";
      return clone(deal);
    },
    async withdrawDeal(dealId, profileId) {
      const en = e();
      const before = en.deals.length;
      en.deals = en.deals.filter((x) => !(x.id === dealId && x.declaredBy === profileId && x.status === "pending"));
      return en.deals.length < before;
    },
    async listDeals(opts) {
      return clone(
        e()
          .deals.filter((x) => !opts?.profileId || x.declaredBy === opts.profileId || x.partnerId === opts.profileId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map(dealView),
      );
    },
    async listPoints(profileId) {
      syncConversions();
      return clone(
        e()
          .points.filter((x) => x.profileId === profileId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      );
    },
    async leaderboard(limit = 20) {
      syncConversions();
      const en = e();
      const optOut = new Set(en.prefs.filter((p) => p.leaderboardOptOut).map((p) => p.profileId));
      const totals = new Map<string, number>();
      for (const x of en.points) if (!optOut.has(x.profileId)) totals.set(x.profileId, (totals.get(x.profileId) ?? 0) + x.points);
      return [...totals.entries()]
        .filter(([, pts]) => pts > 0)
        .map(([profileId, points]) => ({
          profileId,
          name: nameOf(profileId),
          points,
          deals: en.deals.filter((d) => d.status === "confirmed" && (d.declaredBy === profileId || d.partnerId === profileId)).length,
        }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "fr"))
        .slice(0, limit);
    },
  };
}
