/**
 * Types du Lot 4 (engagement) : dashboard à widgets, ressources digitales, parrainage, Espace Business.
 * Ils reflètent supabase/migrations/0006_engagement.sql en camelCase.
 */

/* ---------- dashboard ---------- */

export type WidgetId =
  | "next"
  | "news"
  | "events"
  | "adhesion"
  | "agenda"
  | "weather"
  | "prayer"
  | "offers"
  | "points"
  | "referral"
  | "quote"
  | "salon"
  | "ask"
  | "address";

export type WidgetPref = { id: WidgetId; enabled: boolean };

export type EngagementPrefs = {
  profileId: string;
  widgets: WidgetPref[];
  leaderboardOptOut: boolean;
  updatedAt: string;
};

/* ---------- ressources digitales ---------- */

export type ProductStatus = "draft" | "published" | "archived";
export type ProductCategory = "guide" | "modele" | "formation" | "carnet";

export type Product = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: ProductCategory;
  /** Image de couverture (/img/… ou URL) ; sans image, une couverture typographique est dessinée. */
  coverImage: string | null;
  price: number;
  priceMember: number;
  /** Extrait lisible avant achat. */
  previewText: string | null;
  pages: number | null;
  status: ProductStatus;
  createdAt: string;
  publishedAt: string | null;
};

export type ProductFile = {
  id: string;
  productId: string;
  label: string;
  fileName: string;
  /** Chemin dans le bucket privé « ressources » (mode réel) ; null = PDF d'exemple généré. */
  storagePath: string | null;
  sizeBytes: number | null;
  /** Aperçu gratuit, téléchargeable par toutes les membres. */
  isPreview: boolean;
  sortOrder: number;
  createdAt: string;
};

export type ProductView = Product & { files: ProductFile[]; sales: number };

export type PurchaseMethod = "simulated" | "card" | "transfer" | "free";

export type Purchase = {
  id: string;
  productId: string;
  profileId: string;
  amount: number;
  method: PurchaseMethod;
  status: "paid" | "refunded";
  paymentRef: string | null;
  createdAt: string;
};

export type PurchaseView = Purchase & { product: Product; buyerName: string };

/* ---------- parrainage ---------- */

export type ReferralStatus = "signed_up" | "member" | "cancelled";

export type Referral = {
  id: string;
  referrerId: string;
  referredId: string;
  /** Prénom + initiale, figé à l'inscription. */
  referredName: string;
  code: string;
  status: ReferralStatus;
  createdAt: string;
  convertedAt: string | null;
};

export type RewardKind = "free_month" | "invitation" | "points" | "other";

export type ReferralReward = {
  id: string;
  kind: RewardKind;
  label: string;
  description: string | null;
  points: number;
  active: boolean;
  sortOrder: number;
};

export type RewardGrant = {
  id: string;
  referralId: string;
  rewardId: string | null;
  beneficiaryId: string;
  kind: RewardKind;
  label: string;
  points: number;
  status: "granted" | "delivered";
  createdAt: string;
  deliveredAt: string | null;
};

export type ReferralView = Referral & { referrerName: string; grants: RewardGrant[] };

/* ---------- Espace Business ---------- */

export type DealStatus = "pending" | "confirmed" | "refused";
export type DealCategory = "prestation" | "vente" | "partenariat" | "recommandation" | "autre";

export type Deal = {
  id: string;
  declaredBy: string;
  partnerId: string;
  nature: string;
  category: DealCategory;
  /** Montant estimé (facultatif). */
  amount: number | null;
  /** AAAA-MM-JJ */
  dealDate: string;
  note: string | null;
  status: DealStatus;
  /** Points reçus par chacune des deux membres une fois le deal confirmé. */
  pointsEach: number;
  createdAt: string;
  respondedAt: string | null;
};

export type DealView = Deal & { declaredByName: string; partnerName: string };

export type PointsSource = "deal" | "referral" | "adjust";

export type PointsEntry = {
  id: string;
  profileId: string;
  points: number;
  source: PointsSource;
  refId: string | null;
  label: string;
  createdAt: string;
};

export type LeaderboardRow = { profileId: string; name: string; points: number; deals: number };

export type EngagementSettings = {
  dealPointsBase: number;
  dealPointsPerThousand: number;
  dealPointsBonusCap: number;
  /** Paiement simulé de la boutique (le vrai paiement arrive au Lot 2). */
  simulatedPayments: boolean;
  updatedAt: string;
};

/** Notifications ajoutées par le lot (fusionnées dans NotificationType). */
export type EngagementNotificationType = "purchase_completed" | "referral_signup" | "referral_rewarded" | "deal_declared" | "deal_answered";

/** Actions journalisées par le lot (fusionnées dans AuditAction). */
export type EngagementAuditAction =
  | "product.create"
  | "product.update"
  | "product.publish"
  | "referral.reward_config"
  | "referral.reward_deliver"
  | "deal.settings"
  | "deal.admin_update";

export type EngagementAuditTarget = "product" | "referral" | "deal" | "settings";

/** Données d'exemple du lot (mode démo). */
export type EngagementSeed = {
  settings: EngagementSettings;
  prefs: EngagementPrefs[];
  products: Product[];
  productFiles: ProductFile[];
  purchases: Purchase[];
  referralCodes: Array<{ profileId: string; code: string; createdAt: string }>;
  referrals: Referral[];
  rewards: ReferralReward[];
  grants: RewardGrant[];
  deals: Deal[];
  points: PointsEntry[];
};
