/**
 * Lot 1 — Communauté : interface d'accès aux données du module.
 * `Repo` (src/lib/data/repo.ts) l'étend ; implémentations : ./demo.ts (mémoire) et ./supabase.ts (Postgres).
 */
import type { Message, Profile } from "../../types";
import type {
  ChatGroup,
  DirectoryEntry,
  DirectoryProfile,
  GroupInput,
  GroupMemberStatus,
  GroupRequestView,
  GroupView,
  KeywordAction,
  MessageReport,
  ModerationKeyword,
  NewsInput,
  NewsPost,
  NewsPostView,
  NewsStatus,
  OwnProfileInput,
  ReactionKind,
  ReportResolution,
} from "./types";

export type GroupMemberView = { profile: Profile; status: GroupMemberStatus; createdAt: string };

/** Résultat de la modération automatique d'un message qui vient d'être posté. */
export type AutoModeration = { hidden: boolean; flagged: string[]; reportIds: string[] };

export interface CommunauteRepo {
  /* actualités */
  /** Publications (épinglées d'abord, puis les plus récentes). Brouillons seulement avec includeDrafts (administratrices). */
  listNews(opts: { viewerId: string | null; includeDrafts?: boolean; limit?: number }): Promise<NewsPostView[]>;
  getNews(id: string, viewerId: string | null): Promise<NewsPostView | null>;
  createNews(input: NewsInput, authorId: string, status: NewsStatus): Promise<NewsPost>;
  updateNews(id: string, input: Partial<NewsInput>): Promise<NewsPost>;
  /** Publier (date de publication fixée la première fois) ou repasser en brouillon. */
  setNewsStatus(id: string, status: NewsStatus): Promise<NewsPost>;
  setNewsPinned(id: string, pinned: boolean): Promise<NewsPost>;
  deleteNews(id: string): Promise<void>;
  /** Ajoute ou retire une réaction ; renvoie l'état final. */
  toggleReaction(postId: string, profileId: string, kind: ReactionKind): Promise<{ active: boolean }>;

  /* groupes thématiques */
  /** Groupes visibles par la personne (les groupes privés seulement si elle en fait partie) ; `manage` : tous. */
  listGroups(viewerId: string, opts?: { manage?: boolean }): Promise<GroupView[]>;
  getGroup(idOrSlug: string, viewerId: string, opts?: { manage?: boolean }): Promise<GroupView | null>;
  createGroup(input: GroupInput, actorId: string): Promise<ChatGroup>;
  updateGroup(id: string, input: Partial<GroupInput> & { archived?: boolean }): Promise<ChatGroup>;
  /** Groupe ouvert : membre tout de suite ; sur demande : demande en attente. */
  joinGroup(groupId: string, profileId: string): Promise<GroupMemberStatus>;
  leaveGroup(groupId: string, profileId: string): Promise<void>;
  listGroupMembers(groupId: string): Promise<GroupMemberView[]>;
  listGroupRequests(): Promise<GroupRequestView[]>;
  decideGroupRequest(groupId: string, profileId: string, approve: boolean, actorId: string): Promise<boolean>;

  /* modération */
  listKeywords(): Promise<ModerationKeyword[]>;
  addKeyword(keyword: string, action: KeywordAction, actorId: string): Promise<ModerationKeyword>;
  removeKeyword(id: string): Promise<ModerationKeyword | null>;
  /**
   * Modération par mots-clés d'un message qui vient d'être posté (salon, privé, groupe).
   * Mode réel : déjà faite par le déclencheur SQL, on relit seulement l'état.
   */
  applyKeywordModeration(message: Message): Promise<AutoModeration>;
  getMessage(id: string): Promise<Message | null>;
  reportMessage(messageId: string, reporterId: string, reason: string): Promise<MessageReport | null>;
  listReports(opts?: { status?: "open" | "resolved" | "all"; limit?: number }): Promise<MessageReport[]>;
  countOpenReports(): Promise<number>;
  hideMessage(messageId: string, actorId: string, reason: string): Promise<boolean>;
  restoreMessage(messageId: string, actorId: string): Promise<boolean>;
  resolveReport(reportId: string, resolution: ReportResolution, actorId: string): Promise<MessageReport | null>;

  /* annuaire */
  /** Fiches visibles par `viewer` (confidentialité appliquée ; tout pour une administratrice). */
  listDirectoryEntries(viewer: Profile, opts: { admin: boolean }): Promise<DirectoryEntry[]>;
  getDirectoryProfile(profileId: string): Promise<DirectoryProfile | null>;
  updateOwnProfile(profileId: string, input: OwnProfileInput): Promise<void>;

  /* rappels J-1 */
  /** Inscrites (avec compte) d'un rendez-vous qui n'ont pas encore reçu le rappel. */
  listReminderTargets(eventId: string): Promise<string[]>;
  markRemindersSent(eventId: string, profileIds: string[]): Promise<void>;
}
