/**
 * Lot 1 — Communauté : types du module (actualités, groupes, modération, annuaire, rappels).
 * Ils reflètent les tables de supabase/migrations/0004_communaute.sql en camelCase.
 */
import type { AppNotification, Message } from "../../types";

/* ---------- actualités ---------- */

export type NewsStatus = "draft" | "published";

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  /** Photo du club (/img/…) ou image importée (data:image/jpeg;base64,…). */
  image: string | null;
  pinned: boolean;
  status: NewsStatus;
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const REACTION_KINDS = ["like", "bravo", "merci"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type NewsReaction = { postId: string; profileId: string; kind: ReactionKind; createdAt: string };

export type NewsPostView = NewsPost & {
  authorName: string;
  reactions: Record<ReactionKind, number>;
  /** Réactions de la personne qui regarde. */
  mine: ReactionKind[];
};

export type NewsInput = { title: string; body: string; image: string | null; pinned: boolean };

/* ---------- groupes thématiques ---------- */

export const GROUP_ICONS = ["users", "book", "heart", "spark", "star", "globe", "home", "chat", "crown", "gift", "pin", "cal"] as const;
export type GroupIcon = (typeof GROUP_ICONS)[number];

export type JoinPolicy = "open" | "request";

export type ChatGroup = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: GroupIcon;
  joinPolicy: JoinPolicy;
  /** false : groupe privé, invisible pour les non-membres. */
  listed: boolean;
  createdBy: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type GroupMemberStatus = "member" | "pending";

export type GroupMember = {
  groupId: string;
  profileId: string;
  status: GroupMemberStatus;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};

export type GroupView = ChatGroup & {
  memberCount: number;
  pendingCount: number;
  /** Statut de la personne qui regarde (null : pas membre). */
  myStatus: GroupMemberStatus | null;
  lastMessageAt: string | null;
};

export type GroupInput = { name: string; description: string; icon: GroupIcon; joinPolicy: JoinPolicy; listed: boolean };

export type GroupRequestView = { group: ChatGroup; profileId: string; name: string; job: string | null; createdAt: string };

/* ---------- modération ---------- */

export type KeywordAction = "hide" | "flag";

export type ModerationKeyword = { id: string; keyword: string; action: KeywordAction; createdBy: string | null; createdAt: string };

export type ReportSource = "member" | "keyword" | "moderator";
export type ReportStatus = "open" | "resolved";
export type ReportResolution = "hidden" | "restored" | "warned" | "dismissed";

export type MessageReport = {
  id: string;
  messageId: string;
  /** null : signalement automatique (mot-clé). */
  reporterId: string | null;
  source: ReportSource;
  reason: string;
  keyword: string | null;
  /** Copie du message au moment du signalement (les modératrices le relisent même s'il est masqué). */
  messageBody: string;
  messageAuthorId: string;
  channel: string;
  status: ReportStatus;
  resolution: ReportResolution | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type ReportView = MessageReport & {
  authorName: string;
  reporterName: string | null;
  channelLabel: string;
  /** Le message est-il masqué en ce moment ? */
  hidden: boolean;
};

/** Message tel que stocké, avec son état de modération. */
export type ModeratedMessage = Message & { hiddenAt: string | null; hiddenReason?: string | null };

/* ---------- annuaire ---------- */

export type DirectoryVisibility = "all" | "basic" | "hidden";

export type DirectoryProfile = {
  profileId: string;
  company: string | null;
  sector: string | null;
  skills: string[];
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  lookingFor: string | null;
  offering: string | null;
  visibility: DirectoryVisibility;
  showWhatsapp: boolean;
  showEmail: boolean;
  updatedAt: string;
};

/** Fiche d'annuaire telle qu'une autre membre peut la voir (champs masqués selon la confidentialité). */
export type DirectoryEntry = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  job: string | null;
  /** « basic » : seuls le nom et le métier sont visibles. */
  limited: boolean;
  photo: string | null;
  company: string | null;
  sector: string | null;
  nationality: string | null;
  marrakechSince: string | null;
  bio: string | null;
  skills: string[];
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  lookingFor: string | null;
  offering: string | null;
  whatsapp: string | null;
  email: string | null;
  badge: "Fondatrice" | "Premium" | null;
};

/** Champs de la fiche que la membre modifie elle-même (/espace/moi/profil). */
export type OwnProfileInput = {
  firstName: string;
  lastName: string;
  job: string | null;
  country: string | null;
  marrakechSince: string | null;
  bio: string | null;
  whatsapp: string | null;
  avatarUrl: string | null;
  company: string | null;
  sector: string | null;
  skills: string[];
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  lookingFor: string | null;
  offering: string | null;
  visibility: DirectoryVisibility;
  showWhatsapp: boolean;
  showEmail: boolean;
};

/* ---------- rappels J-1 ---------- */

export type EventReminderSent = { eventId: string; profileId: string; sentAt: string };

/* ---------- données du module (mode démo et seed) ---------- */

export type CommunauteData = {
  news: NewsPost[];
  reactions: NewsReaction[];
  groups: ChatGroup[];
  groupMembers: GroupMember[];
  keywords: ModerationKeyword[];
  reports: MessageReport[];
  /** Corps d'origine des messages masqués (rendu au rétablissement). */
  hiddenBodies: Array<{ messageId: string; body: string }>;
  directory: DirectoryProfile[];
  remindersSent: EventReminderSent[];
  /** Messages d'exemple des groupes et du salon (ajoutés à la table messages par src/lib/seed.ts). */
  messages: Message[];
  /** Notifications d'exemple du module (ajoutées à la table notifications par src/lib/seed.ts). */
  notifications: AppNotification[];
};
