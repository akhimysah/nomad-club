/**
 * Lot 1 — Communauté : implémentation « réelle » (Supabase), branchée dans src/lib/data/supabase-repo.ts.
 * Lecture et écriture avec la session de la personne (RLS de 0004_communaute.sql) ; les opérations
 * sensibles passent par les fonctions SQL (join_group, report_message, moderate_message, resolve_report,
 * decide_group_request, directory_list). Les rappels J-1 du cron utilisent la clé service.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isGrantableRole } from "../../permissions";
import { supabaseAdmin, supabaseServer } from "../../supabase/server";
import type { Message, Profile } from "../../types";
import { normalizeKeyword, slugifyGroup } from "./domain";
import type { CommunauteRepo, GroupMemberView } from "./repo";
import type {
  ChatGroup,
  DirectoryEntry,
  DirectoryProfile,
  GroupMemberStatus,
  GroupView,
  MessageReport,
  ModerationKeyword,
  NewsPost,
  NewsPostView,
  ReactionKind,
} from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const db = () => supabaseServer();
/** Cron (sans session) : clé service si elle est configurée. */
const trusted = async (): Promise<SupabaseClient> => (process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : supabaseServer());

const PROFILE = "*, user_roles:user_roles!user_roles_profile_id_fkey(role)";

function toProfile(r: Row): Profile {
  return {
    id: str(r.id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    whatsapp: strN(r.whatsapp),
    email: strN(r.email),
    job: strN(r.job),
    country: strN(r.country),
    bio: strN(r.bio),
    roles: ((r.user_roles as Row[] | null) ?? []).map((x) => x.role).filter(isGrantableRole),
    plan: (r.plan as Profile["plan"]) ?? "free",
    planEndsAt: strN(r.plan_ends_at),
    avatarUrl: strN(r.avatar_url),
    marrakechSince: strN(r.marrakech_since),
    cardNumber: strN(r.card_number),
    createdAt: str(r.created_at),
  };
}

function toNews(r: Row): NewsPost {
  return {
    id: str(r.id),
    title: str(r.title),
    body: str(r.body),
    image: strN(r.image),
    pinned: Boolean(r.pinned),
    commentsEnabled: Boolean(r.comments_enabled),
    status: (r.status as NewsPost["status"]) ?? "draft",
    authorId: strN(r.author_id),
    publishedAt: strN(r.published_at),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

function toGroup(r: Row): ChatGroup {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    description: str(r.description),
    icon: (r.icon as ChatGroup["icon"]) ?? "users",
    joinPolicy: (r.join_policy as ChatGroup["joinPolicy"]) ?? "open",
    listed: Boolean(r.listed),
    createdBy: strN(r.created_by),
    createdAt: str(r.created_at),
    archivedAt: strN(r.archived_at),
  };
}

function toReport(r: Row): MessageReport {
  return {
    id: str(r.id),
    messageId: str(r.message_id),
    reporterId: strN(r.reporter_id),
    source: r.source as MessageReport["source"],
    reason: str(r.reason),
    keyword: strN(r.keyword),
    messageBody: str(r.message_body),
    messageAuthorId: str(r.message_author_id),
    channel: str(r.channel),
    status: r.status as MessageReport["status"],
    resolution: (r.resolution as MessageReport["resolution"]) ?? null,
    resolvedBy: strN(r.resolved_by),
    resolvedAt: strN(r.resolved_at),
    createdAt: str(r.created_at),
  };
}

function toKeyword(r: Row): ModerationKeyword {
  return { id: str(r.id), keyword: str(r.keyword), action: r.action as ModerationKeyword["action"], createdBy: strN(r.created_by), createdAt: str(r.created_at) };
}

function toDirectoryProfile(r: Row): DirectoryProfile {
  return {
    profileId: str(r.profile_id),
    company: strN(r.company),
    sector: strN(r.sector),
    skills: (r.skills as string[] | null) ?? [],
    instagram: strN(r.instagram),
    linkedin: strN(r.linkedin),
    website: strN(r.website),
    lookingFor: strN(r.looking_for),
    offering: strN(r.offering),
    visibility: (r.visibility as DirectoryProfile["visibility"]) ?? "all",
    showWhatsapp: Boolean(r.show_whatsapp),
    showEmail: Boolean(r.show_email),
    updatedAt: str(r.updated_at),
  };
}

function toMessage(r: Row): Message {
  return { id: str(r.id), channel: str(r.channel), authorId: str(r.author_id), body: str(r.body), createdAt: str(r.created_at), readAt: strN(r.read_at), hiddenAt: strN(r.hidden_at) };
}

/** Message d'erreur SQL → phrase lisible. */
function friendly(m: string): string {
  if (m.includes("private_group")) return "Ce groupe est privé : il faut y être invitée.";
  if (m.includes("group_not_found")) return "Groupe introuvable.";
  if (m.includes("own_message")) return "Tu ne peux pas signaler ton propre message.";
  if (m.includes("message_not_found")) return "Message introuvable.";
  if (m.includes("moderators_only")) return "Réservé à la modération.";
  if (m.includes("members_only")) return "Réservé aux adhérentes.";
  if (m.includes("moderation_keywords_unique")) return "Ce mot-clé existe déjà.";
  return m;
}

async function newsViews(c: SupabaseClient, rows: Row[], viewerId: string | null): Promise<NewsPostView[]> {
  const posts = rows.map(toNews);
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.authorId).filter((x): x is string => !!x))];
  const [reactions, authors, comments] = await Promise.all([
    c.from("news_reactions").select("post_id, profile_id, kind").in("post_id", ids),
    authorIds.length ? c.from("profiles").select("id, first_name, last_name").in("id", authorIds) : Promise.resolve({ data: [], error: null }),
    c.from("news_comments").select("post_id").in("post_id", ids),
  ]);
  const cs = (check(comments) as Row[]) ?? [];
  const rs = (check(reactions) as Row[]) ?? [];
  const names = new Map(((check(authors) as Row[]) ?? []).map((a) => [str(a.id), [str(a.first_name), str(a.last_name)].filter(Boolean).join(" ")]));
  return posts.map((p) => {
    const mine = rs.filter((r) => str(r.post_id) === p.id);
    const count = (k: ReactionKind) => mine.filter((r) => r.kind === k).length;
    return {
      ...p,
      authorName: (p.authorId && names.get(p.authorId)) || "Nomad Club",
      reactions: { like: count("like"), bravo: count("bravo"), merci: count("merci") },
      mine: viewerId ? mine.filter((r) => str(r.profile_id) === viewerId).map((r) => r.kind as ReactionKind) : [],
      commentCount: cs.filter((x) => str(x.post_id) === p.id).length,
    };
  });
}

async function groupViews(c: SupabaseClient, groups: ChatGroup[], viewerId: string): Promise<GroupView[]> {
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  // la RLS ne montre les membres que des groupes dont on fait partie (ou tout, pour la modération)
  const members = (check(await c.from("chat_group_members").select("group_id, profile_id, status").in("group_id", ids)) as Row[]) ?? [];
  const lastRows = (check(
    await c.from("messages").select("channel, created_at").in("channel", ids.map((id) => `group:${id}`)).order("created_at", { ascending: false }).limit(200),
  ) as Row[]) ?? [];
  return groups.map((g) => {
    const ms = members.filter((m) => str(m.group_id) === g.id);
    const mine = ms.find((m) => str(m.profile_id) === viewerId);
    return {
      ...g,
      memberCount: ms.filter((m) => m.status === "member").length,
      pendingCount: ms.filter((m) => m.status === "pending").length,
      myStatus: (mine?.status as GroupMemberStatus | undefined) ?? null,
      lastMessageAt: strN(lastRows.find((r) => str(r.channel) === `group:${g.id}`)?.created_at),
    };
  });
}

export const communauteSupabaseRepo: CommunauteRepo = {
  /* ---------- actualités ---------- */
  async listNews({ viewerId, includeDrafts, limit }) {
    const c = await db();
    let qy = c.from("news_posts").select("*").order("pinned", { ascending: false }).order("published_at", { ascending: false, nullsFirst: true }).limit(limit ?? 100);
    if (!includeDrafts) qy = qy.eq("status", "published");
    return newsViews(c, check(await qy) as Row[], viewerId);
  },
  async getNews(id, viewerId) {
    const c = await db();
    const r = check(await c.from("news_posts").select("*").eq("id", id).maybeSingle()) as Row | null;
    return r ? (await newsViews(c, [r], viewerId))[0] : null;
  },
  async createNews(input, authorId, status) {
    const c = await db();
    const now = new Date().toISOString();
    const row = { title: input.title, body: input.body, image: input.image, pinned: input.pinned, comments_enabled: input.commentsEnabled, status, author_id: authorId, published_at: status === "published" ? now : null };
    return toNews(check(await c.from("news_posts").insert(row).select("*").single()) as Row);
  },
  async updateNews(id, input) {
    const c = await db();
    const row: Row = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) row.title = input.title;
    if (input.body !== undefined) row.body = input.body;
    if (input.image !== undefined) row.image = input.image;
    if (input.pinned !== undefined) row.pinned = input.pinned;
    if (input.commentsEnabled !== undefined) row.comments_enabled = input.commentsEnabled;
    return toNews(check(await c.from("news_posts").update(row).eq("id", id).select("*").single()) as Row);
  },
  async setNewsStatus(id, status) {
    const c = await db();
    const cur = check(await c.from("news_posts").select("published_at").eq("id", id).maybeSingle()) as Row | null;
    if (!cur) throw new Error("Publication introuvable.");
    const now = new Date().toISOString();
    const row: Row = { status, updated_at: now };
    if (status === "published" && !cur.published_at) row.published_at = now;
    return toNews(check(await c.from("news_posts").update(row).eq("id", id).select("*").single()) as Row);
  },
  async setNewsPinned(id, pinned) {
    const c = await db();
    return toNews(check(await c.from("news_posts").update({ pinned, updated_at: new Date().toISOString() }).eq("id", id).select("*").single()) as Row);
  },
  async deleteNews(id) {
    const c = await db();
    check(await c.from("news_posts").delete().eq("id", id));
  },
  async toggleReaction(postId, profileId, kind) {
    const c = await db();
    const existing = check(await c.from("news_reactions").select("post_id").eq("post_id", postId).eq("profile_id", profileId).eq("kind", kind).maybeSingle());
    if (existing) {
      check(await c.from("news_reactions").delete().eq("post_id", postId).eq("profile_id", profileId).eq("kind", kind));
      return { active: false };
    }
    check(await c.from("news_reactions").insert({ post_id: postId, profile_id: profileId, kind }));
    return { active: true };
  },

  async listNewsComments(postId) {
    const c = await db();
    const rows = check(
      await c.from("news_comments").select(`*, author:profiles(${PROFILE})`).eq("post_id", postId).order("created_at"),
    ) as Row[];
    return rows.map((r) => {
      const a = r.author ? toProfile(r.author as Row) : null;
      return { id: str(r.id), postId: str(r.post_id), authorId: str(r.author_id), body: str(r.body), createdAt: str(r.created_at), authorName: a ? [a.firstName, a.lastName].filter(Boolean).join(" ") : "Membre", founder: !!a?.roles.includes("admin") };
    });
  },
  async addNewsComment(postId, authorId, body) {
    const c = await db();
    const res = await c.from("news_comments").insert({ post_id: postId, author_id: authorId, body }).select(`*, author:profiles(${PROFILE})`).single();
    if (res.error) throw new Error(res.error.code === "42501" ? "Les commentaires sont fermés sur cette publication." : res.error.message);
    const r = res.data as Row;
    const a = r.author ? toProfile(r.author as Row) : null;
    return { id: str(r.id), postId, authorId, body: str(r.body), createdAt: str(r.created_at), authorName: a ? [a.firstName, a.lastName].filter(Boolean).join(" ") : "Membre", founder: !!a?.roles.includes("admin") };
  },
  async deleteNewsComment(id) {
    const c = await db();
    const rows = check(await c.from("news_comments").delete().eq("id", id).select("post_id, author_id, body")) as Row[];
    return rows.length ? { postId: str(rows[0].post_id), authorId: str(rows[0].author_id), body: str(rows[0].body) } : null;
  },

  /* ---------- groupes ---------- */
  async listGroups(viewerId, opts) {
    const c = await db();
    let qy = c.from("chat_groups").select("*").order("name");
    if (!opts?.manage) qy = qy.is("archived_at", null);
    return groupViews(c, (check(await qy) as Row[]).map(toGroup), viewerId);
  },
  async getGroup(idOrSlug, viewerId, opts) {
    const c = await db();
    const col = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? "id" : "slug";
    const r = check(await c.from("chat_groups").select("*").eq(col, idOrSlug).maybeSingle()) as Row | null;
    if (!r) return null;
    const g = toGroup(r);
    if (!opts?.manage && g.archivedAt) return null;
    return (await groupViews(c, [g], viewerId))[0];
  },
  async createGroup(input, actorId) {
    const c = await db();
    const base = slugifyGroup(input.name) || "groupe";
    let slug = base;
    for (let i = 2; ; i++) {
      const exists = check(await c.from("chat_groups").select("id").eq("slug", slug).maybeSingle());
      if (!exists) break;
      slug = `${base}-${i}`;
    }
    const row = { slug, name: input.name, description: input.description, icon: input.icon, join_policy: input.joinPolicy, listed: input.listed, created_by: actorId };
    const g = toGroup(check(await c.from("chat_groups").insert(row).select("*").single()) as Row);
    check(await c.from("chat_group_members").insert({ group_id: g.id, profile_id: actorId, status: "member", decided_by: actorId, decided_at: new Date().toISOString() }));
    return g;
  },
  async updateGroup(id, input) {
    const c = await db();
    const row: Row = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.description !== undefined) row.description = input.description;
    if (input.icon !== undefined) row.icon = input.icon;
    if (input.joinPolicy !== undefined) row.join_policy = input.joinPolicy;
    if (input.listed !== undefined) row.listed = input.listed;
    if (input.archived !== undefined) row.archived_at = input.archived ? new Date().toISOString() : null;
    return toGroup(check(await c.from("chat_groups").update(row).eq("id", id).select("*").single()) as Row);
  },
  async joinGroup(groupId) {
    const c = await db();
    const res = await c.rpc("join_group", { p_group: groupId });
    if (res.error) throw new Error(friendly(res.error.message));
    return res.data as GroupMemberStatus;
  },
  async leaveGroup(groupId, profileId) {
    const c = await db();
    check(await c.from("chat_group_members").delete().eq("group_id", groupId).eq("profile_id", profileId));
  },
  async listGroupMembers(groupId) {
    const c = await db();
    const rows = check(await c.from("chat_group_members").select(`status, created_at, profile:profiles!chat_group_members_profile_id_fkey(${PROFILE})`).eq("group_id", groupId)) as Row[];
    return rows
      .filter((r) => r.profile)
      .map((r): GroupMemberView => ({ profile: toProfile(r.profile as Row), status: r.status as GroupMemberStatus, createdAt: str(r.created_at) }))
      .sort((a, b) => a.profile.firstName.localeCompare(b.profile.firstName, "fr"));
  },
  async listGroupRequests() {
    const c = await db();
    const rows = check(
      await c.from("chat_group_members").select("profile_id, created_at, group:chat_groups(*), profile:profiles!chat_group_members_profile_id_fkey(first_name, last_name, job)").eq("status", "pending").order("created_at"),
    ) as Row[];
    return rows
      .filter((r) => r.group && r.profile)
      .map((r) => {
        const p = r.profile as Row;
        return { group: toGroup(r.group as Row), profileId: str(r.profile_id), name: [str(p.first_name), str(p.last_name)].filter(Boolean).join(" "), job: strN(p.job), createdAt: str(r.created_at) };
      });
  },
  async decideGroupRequest(groupId, profileId, approve) {
    const c = await db();
    const res = await c.rpc("decide_group_request", { p_group: groupId, p_profile: profileId, p_approve: approve });
    if (res.error) throw new Error(friendly(res.error.message));
    return Boolean(res.data);
  },

  /* ---------- modération ---------- */
  async listKeywords() {
    const c = await db();
    return (check(await c.from("moderation_keywords").select("*").order("keyword")) as Row[]).map(toKeyword);
  },
  async addKeyword(keyword, action, actorId) {
    const c = await db();
    const res = await c.from("moderation_keywords").insert({ keyword: normalizeKeyword(keyword), action, created_by: actorId }).select("*").single();
    if (res.error) throw new Error(friendly(res.error.message));
    return toKeyword(res.data as Row);
  },
  async removeKeyword(id) {
    const c = await db();
    const rows = check(await c.from("moderation_keywords").delete().eq("id", id).select("*")) as Row[];
    return rows.length ? toKeyword(rows[0]) : null;
  },
  async applyKeywordModeration(message) {
    // Le déclencheur messages_keywords a déjà masqué / signalé : on relit l'état du message.
    const c = await db();
    const r = check(await c.from("messages").select("hidden_at").eq("id", message.id).maybeSingle()) as Row | null;
    return { hidden: Boolean(r?.hidden_at), flagged: [], reportIds: [] };
  },
  async getMessage(id) {
    const c = await db();
    const r = check(await c.from("messages").select("*").eq("id", id).maybeSingle()) as Row | null;
    return r ? toMessage(r) : null;
  },
  async reportMessage(messageId, reporterId, reason) {
    void reporterId;
    const c = await db();
    const res = await c.rpc("report_message", { p_message: messageId, p_reason: reason });
    if (res.error) throw new Error(friendly(res.error.message));
    const r = check(await c.from("message_reports").select("*").eq("id", str(res.data)).maybeSingle()) as Row | null;
    return r ? toReport(r) : null;
  },
  async listReports(opts) {
    const c = await db();
    const status = opts?.status ?? "open";
    let qy = c.from("message_reports").select("*").order("created_at", { ascending: false }).limit(opts?.limit ?? 200);
    if (status !== "all") qy = qy.eq("status", status);
    return (check(await qy) as Row[]).map(toReport);
  },
  async countOpenReports() {
    const c = await db();
    const res = await c.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open");
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async hideMessage(messageId, actorId, reason) {
    void actorId;
    const c = await db();
    const res = await c.rpc("moderate_message", { p_message: messageId, p_action: "hide", p_reason: reason });
    if (res.error) throw new Error(friendly(res.error.message));
    return Boolean(res.data);
  },
  async restoreMessage(messageId) {
    const c = await db();
    const res = await c.rpc("moderate_message", { p_message: messageId, p_action: "restore" });
    if (res.error) throw new Error(friendly(res.error.message));
    return Boolean(res.data);
  },
  async resolveReport(reportId, resolution) {
    const c = await db();
    const res = await c.rpc("resolve_report", { p_report: reportId, p_resolution: resolution });
    if (res.error) throw new Error(friendly(res.error.message));
    const r = res.data as Row | null;
    return r && r.id ? toReport(r) : null;
  },

  /* ---------- annuaire ---------- */
  async listDirectoryEntries() {
    // directory_list() applique la confidentialité côté base (et voit tout pour une administratrice).
    const c = await db();
    const rows = check(await c.rpc("directory_list")) as Row[];
    return rows.map(
      (r): DirectoryEntry => ({
        id: str(r.id),
        firstName: str(r.first_name),
        lastName: str(r.last_name),
        name: [str(r.first_name), str(r.last_name)].filter(Boolean).join(" "),
        job: strN(r.job),
        limited: Boolean(r.limited),
        photo: strN(r.avatar_url),
        company: strN(r.company),
        sector: strN(r.sector),
        nationality: strN(r.country),
        marrakechSince: strN(r.marrakech_since),
        bio: strN(r.bio),
        skills: (r.skills as string[] | null) ?? [],
        instagram: strN(r.instagram),
        linkedin: strN(r.linkedin),
        website: strN(r.website),
        lookingFor: strN(r.looking_for),
        offering: strN(r.offering),
        whatsapp: strN(r.whatsapp),
        email: strN(r.email),
        badge: r.is_founder ? "Fondatrice" : r.plan === "premium" ? "Premium" : null,
      }),
    );
  },
  async getDirectoryProfile(profileId) {
    const c = await db();
    const r = check(await c.from("directory_profiles").select("*").eq("profile_id", profileId).maybeSingle()) as Row | null;
    return r ? toDirectoryProfile(r) : null;
  },
  async updateOwnProfile(profileId, input) {
    const c = await db();
    check(
      await c
        .from("profiles")
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          job: input.job,
          country: input.country,
          marrakech_since: input.marrakechSince,
          bio: input.bio,
          whatsapp: input.whatsapp,
          avatar_url: input.avatarUrl,
        })
        .eq("id", profileId),
    );
    check(
      await c.from("directory_profiles").upsert(
        {
          profile_id: profileId,
          company: input.company,
          sector: input.sector,
          skills: input.skills,
          instagram: input.instagram,
          linkedin: input.linkedin,
          website: input.website,
          looking_for: input.lookingFor,
          offering: input.offering,
          visibility: input.visibility,
          show_whatsapp: input.showWhatsapp,
          show_email: input.showEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      ),
    );
  },

  /* ---------- rappels J-1 ---------- */
  async listReminderTargets(eventId) {
    const c = await trusted();
    const [bookings, sent] = await Promise.all([
      c.from("bookings").select("profile_id").eq("event_id", eventId).in("status", ["paid", "offered", "pending"]).not("profile_id", "is", null),
      c.from("event_reminders").select("profile_id").eq("event_id", eventId),
    ]);
    const done = new Set(((check(sent) as Row[]) ?? []).map((r) => str(r.profile_id)));
    return [...new Set(((check(bookings) as Row[]) ?? []).map((r) => str(r.profile_id)))].filter((id) => !done.has(id));
  },
  async markRemindersSent(eventId, profileIds) {
    if (!profileIds.length) return;
    const c = await trusted();
    check(await c.from("event_reminders").upsert(profileIds.map((profile_id) => ({ event_id: eventId, profile_id })), { onConflict: "event_id,profile_id", ignoreDuplicates: true }));
  },
};
