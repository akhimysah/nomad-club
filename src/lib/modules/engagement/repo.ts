/**
 * Accès aux données du Lot 4. `Repo` (src/lib/data/repo.ts) étend cette interface ;
 * implémentations : demo.ts (mémoire) et supabase.ts (Postgres + RLS).
 */
import type {
  Deal,
  DealCategory,
  DealView,
  EngagementPrefs,
  EngagementSettings,
  LeaderboardRow,
  PointsEntry,
  Product,
  ProductCategory,
  ProductFile,
  ProductStatus,
  ProductView,
  Purchase,
  PurchaseMethod,
  PurchaseView,
  Referral,
  ReferralReward,
  ReferralView,
  RewardGrant,
  RewardKind,
  WidgetPref,
} from "./types";

export type ProductInput = {
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  category: ProductCategory;
  coverImage: string | null;
  price: number;
  priceMember: number;
  previewText: string | null;
  pages: number | null;
};

export type ProductFileInput = {
  productId: string;
  label: string;
  fileName: string;
  isPreview: boolean;
  /** Contenu du fichier envoyé par l'admin (null : PDF d'exemple généré en démo). */
  bytes: Uint8Array | null;
  contentType: string;
};

export type PurchaseInput = { productId: string; profileId: string; amount: number; method: PurchaseMethod; paymentRef: string | null };

/** Où récupérer un fichier acheté : URL signée à durée courte (Storage), octets (démo), ou PDF d'exemple à générer. */
export type FileDelivery = { kind: "url"; url: string } | { kind: "bytes"; bytes: Uint8Array; contentType: string } | { kind: "generated" };

export type RewardInput = { kind: RewardKind; label: string; description: string | null; points: number; active: boolean };

export type DealInput = {
  declaredBy: string;
  partnerId: string;
  nature: string;
  category: DealCategory;
  amount: number | null;
  dealDate: string;
  note: string | null;
};

export interface EngagementRepo {
  /* réglages et préférences */
  getEngagementSettings(): Promise<EngagementSettings>;
  updateEngagementSettings(patch: Partial<Omit<EngagementSettings, "updatedAt">>, actorId: string): Promise<EngagementSettings>;
  getEngagementPrefs(profileId: string): Promise<EngagementPrefs | null>;
  saveEngagementPrefs(profileId: string, patch: { widgets?: WidgetPref[]; leaderboardOptOut?: boolean }): Promise<EngagementPrefs>;

  /* boutique */
  /** Produits (publiés par défaut ; « all » pour l'admin), avec fichiers visibles et nombre de ventes. */
  listProducts(opts?: { status?: ProductStatus | "all" }): Promise<ProductView[]>;
  getProduct(by: { id?: string; slug?: string }): Promise<ProductView | null>;
  saveProduct(input: ProductInput, id: string | null, actorId: string): Promise<Product>;
  setProductStatus(id: string, status: ProductStatus): Promise<Product>;
  addProductFile(input: ProductFileInput): Promise<ProductFile>;
  removeProductFile(fileId: string): Promise<void>;
  /** Fichier lisible par la personne (mode réel : la RLS vérifie l'achat ou l'aperçu). */
  getProductFile(fileId: string): Promise<ProductFile | null>;
  fileDelivery(file: ProductFile): Promise<FileDelivery>;
  /** Enregistre un achat payé (paiement déjà confirmé par billing.ts). */
  recordPurchase(input: PurchaseInput): Promise<Purchase>;
  /** Achats d'une personne, ou tous (admin). */
  listPurchases(opts?: { profileId?: string }): Promise<PurchaseView[]>;
  hasPurchased(profileId: string, productId: string): Promise<boolean>;

  /* parrainage */
  /** Code personnel (créé à la première demande). */
  getReferralCode(profileId: string): Promise<string>;
  /** Inscription d'une filleule avec un code (ignoré si déjà parrainée, déjà membre ou code inconnu). */
  claimReferral(profileId: string, code: string): Promise<Referral | null>;
  /** Parrainages d'une marraine, ou tous (admin). */
  listReferrals(opts?: { referrerId?: string }): Promise<ReferralView[]>;
  listRewards(opts?: { all?: boolean }): Promise<ReferralReward[]>;
  saveReward(input: RewardInput, id: string | null): Promise<ReferralReward>;
  listGrants(opts?: { beneficiaryId?: string }): Promise<RewardGrant[]>;
  deliverGrant(id: string, actorId: string): Promise<RewardGrant | null>;

  /* Espace Business */
  declareDeal(input: DealInput): Promise<Deal>;
  /** Réponse de l'autre membre ; points attribués aux deux si confirmé. */
  respondDeal(dealId: string, profileId: string, accept: boolean): Promise<Deal | null>;
  withdrawDeal(dealId: string, profileId: string): Promise<boolean>;
  /** Deals d'une personne (déclarés ou reçus), ou tous (admin). */
  listDeals(opts?: { profileId?: string }): Promise<DealView[]>;
  listPoints(profileId: string): Promise<PointsEntry[]>;
  leaderboard(limit?: number): Promise<LeaderboardRow[]>;
}
