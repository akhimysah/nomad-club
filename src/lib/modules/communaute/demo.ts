/**
 * Lot 1 — Communauté : implémentation « démo » (mémoire), branchée dans src/lib/data/demo-repo.ts.
 * Reçoit l'accès au jeu en mémoire (`db`) pour éviter une dépendance circulaire.
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../../clock";
import { hasAnyRole, inCircle, isAdmin } from "../../permissions";
import type { SeedData } from "../../seed";
import type { AppNotification, Message, Profile } from "../../types";
import { emptyDirectoryProfile, groupIdOfChannel, HIDDEN_BODY, matchKeywords, normalizeKeyword, slugifyGroup, toDirectoryEntry } from "./domain";
import type { CommunauteRepo } from "./repo";
import type { ChatGroup, CommunauteData, GroupView, MessageReport, NewsPost, NewsPostView, ReactionKind } from "./types";

const clone = <T>(v: T): T => structuredClone(v);
const fullName = (p: Pick<Profile, "firstName" | "lastName">) => [p.firstName, p.lastName].filter(Boolean).join(" ");

export function createCommunauteDemoRepo(db: () => SeedData): CommunauteRepo {
  const c = (): CommunauteData => db().communaute;

  function newsView(d: SeedData, n: NewsPost, viewerId: string | null): NewsPostView {
    const rs = d.communaute.reactions.filter((r) => r.postId === n.id);
    const count = (k: ReactionKind) => rs.filter((r) => r.kind === k).length;
    const author = n.authorId ? d.profiles.find((p) => p.id === n.authorId) : null;
    return {
      ...clone(n),
      authorName: author ? fullName(author) : "Nomad Club",
      reactions: { like: count("like"), bravo: count("bravo"), merci: count("merci") },
      mine: viewerId ? rs.filter((r) => r.profileId === viewerId).map((r) => r.kind) : [],
      commentCount: d.communaute.comments.filter((x) => x.postId === n.id).length,
    };
  }

  function groupView(d: SeedData, g: ChatGroup, viewerId: string): GroupView {
    const members = d.communaute.groupMembers.filter((m) => m.groupId === g.id);
    const mine = members.find((m) => m.profileId === viewerId);
    const last = d.messages.filter((m) => m.channel === `group:${g.id}`).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return {
      ...clone(g),
      memberCount: members.filter((m) => m.status === "member").length,
      pendingCount: members.filter((m) => m.status === "pending").length,
      myStatus: mine?.status ?? null,
      lastMessageAt: last?.createdAt ?? null,
    };
  }

  function findNews(id: string): NewsPost {
    const n = c().news.find((x) => x.id === id);
    if (!n) throw new Error("Publication introuvable.");
    return n;
  }

  /** Enregistre des notifications (en respectant les préférences), comme les fonctions SQL du module. */
  function push(d: SeedData, rows: Array<Omit<AppNotification, "id" | "readAt" | "createdAt">>) {
    const muted = (r: { recipientId: string; type: AppNotification["type"] }) =>
      d.notificationPrefs.some((p) => p.profileId === r.recipientId && p.type === r.type && !p.inApp);
    d.notifications.push(...rows.filter((r) => !muted(r)).map((r) => ({ id: randomUUID(), ...r, readAt: null, createdAt: nowIso() })));
  }

  /** Prévient les modératrices et administratrices (signalement, demande de groupe), comme nc_notify_moderators. */
  function notifyModerators(d: SeedData, type: "moderation_report" | "group_request", title: string, body: string, except: string | null, links: { admin: string; moderator: string }) {
    push(
      d,
      d.profiles
        .filter((p) => hasAnyRole(p, ["admin", "moderator"]) && p.id !== except)
        .map((p) => ({ recipientId: p.id, type, title, body, link: isAdmin(p) ? links.admin : links.moderator })),
    );
  }

  function notifyReport(d: SeedData, r: MessageReport) {
    if (r.source === "moderator") return;
    notifyModerators(d, "moderation_report", r.source === "member" ? "Nouveau signalement" : `Mot-clé repéré : ${r.keyword ?? ""}`, `« ${r.messageBody.slice(0, 120)} »`, r.reporterId, {
      admin: "/fondatrices/communaute/moderation",
      moderator: "/espace/moderation",
    });
  }

  function hide(d: SeedData, m: Message, actorId: string | null, reason: string) {
    if (m.hiddenAt) return;
    d.communaute.hiddenBodies = d.communaute.hiddenBodies.filter((h) => h.messageId !== m.id);
    d.communaute.hiddenBodies.push({ messageId: m.id, body: m.body });
    m.body = HIDDEN_BODY;
    m.hiddenAt = nowIso();
    void actorId;
    void reason;
  }

  function makeReport(d: SeedData, m: Message, o: { reporterId: string | null; source: MessageReport["source"]; reason: string; keyword: string | null }): MessageReport {
    const original = d.communaute.hiddenBodies.find((h) => h.messageId === m.id)?.body ?? m.body;
    const r: MessageReport = {
      id: randomUUID(),
      messageId: m.id,
      reporterId: o.reporterId,
      source: o.source,
      reason: o.reason,
      keyword: o.keyword,
      messageBody: original,
      messageAuthorId: m.authorId,
      channel: m.channel,
      status: "open",
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: nowIso(),
    };
    d.communaute.reports.push(r);
    return r;
  }

  return {
    /* ---------- actualités ---------- */
    async listNews({ viewerId, includeDrafts, limit }) {
      const d = db();
      return d.communaute.news
        .filter((n) => includeDrafts || n.status === "published")
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          const ka = a.publishedAt ?? a.updatedAt;
          const kb = b.publishedAt ?? b.updatedAt;
          return ka < kb ? 1 : -1;
        })
        .slice(0, limit ?? 100)
        .map((n) => newsView(d, n, viewerId));
    },
    async getNews(id, viewerId) {
      const d = db();
      const n = d.communaute.news.find((x) => x.id === id);
      return n ? newsView(d, n, viewerId) : null;
    },
    async createNews(input, authorId, status) {
      const at = nowIso();
      const n: NewsPost = { id: randomUUID(), ...input, status, authorId, publishedAt: status === "published" ? at : null, createdAt: at, updatedAt: at };
      c().news.push(n);
      return clone(n);
    },
    async updateNews(id, input) {
      const n = findNews(id);
      Object.assign(n, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)), { updatedAt: nowIso() });
      return clone(n);
    },
    async setNewsStatus(id, status) {
      const n = findNews(id);
      n.status = status;
      if (status === "published" && !n.publishedAt) n.publishedAt = nowIso();
      n.updatedAt = nowIso();
      return clone(n);
    },
    async setNewsPinned(id, pinned) {
      const n = findNews(id);
      n.pinned = pinned;
      n.updatedAt = nowIso();
      return clone(n);
    },
    async deleteNews(id) {
      const d = c();
      d.news = d.news.filter((n) => n.id !== id);
      d.reactions = d.reactions.filter((r) => r.postId !== id);
      d.comments = d.comments.filter((r) => r.postId !== id);
    },
    async toggleReaction(postId, profileId, kind) {
      const d = c();
      const n = d.news.find((x) => x.id === postId && x.status === "published");
      if (!n) throw new Error("Publication introuvable.");
      const i = d.reactions.findIndex((r) => r.postId === postId && r.profileId === profileId && r.kind === kind);
      if (i >= 0) {
        d.reactions.splice(i, 1);
        return { active: false };
      }
      d.reactions.push({ postId, profileId, kind, createdAt: nowIso() });
      return { active: true };
    },

    async listNewsComments(postId) {
      const d = db();
      return d.communaute.comments
        .filter((x) => x.postId === postId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map((x) => {
          const a = d.profiles.find((p) => p.id === x.authorId);
          return { ...clone(x), authorName: a ? fullName(a) : "Membre", founder: isAdmin(a ?? null) };
        });
    },
    async addNewsComment(postId, authorId, body) {
      const d = db();
      const n = d.communaute.news.find((x) => x.id === postId && x.status === "published");
      if (!n || !n.commentsEnabled) throw new Error("Les commentaires sont fermés sur cette publication.");
      const x = { id: randomUUID(), postId, authorId, body, createdAt: nowIso() };
      d.communaute.comments.push(x);
      const a = d.profiles.find((p) => p.id === authorId);
      return { ...clone(x), authorName: a ? fullName(a) : "Membre", founder: isAdmin(a ?? null) };
    },
    async deleteNewsComment(id) {
      const d = c();
      const x = d.comments.find((y) => y.id === id);
      if (!x) return null;
      d.comments = d.comments.filter((y) => y !== x);
      return { postId: x.postId, authorId: x.authorId, body: x.body };
    },

    /* ---------- groupes ---------- */
    async listGroups(viewerId, opts) {
      const d = db();
      return d.communaute.groups
        .filter((g) => opts?.manage || (!g.archivedAt && (g.listed || d.communaute.groupMembers.some((m) => m.groupId === g.id && m.profileId === viewerId))))
        .map((g) => groupView(d, g, viewerId))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
    async getGroup(idOrSlug, viewerId, opts) {
      const d = db();
      const g = d.communaute.groups.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
      if (!g) return null;
      const member = d.communaute.groupMembers.some((m) => m.groupId === g.id && m.profileId === viewerId);
      if (!opts?.manage && (g.archivedAt || (!g.listed && !member))) return null;
      return groupView(d, g, viewerId);
    },
    async createGroup(input, actorId) {
      const d = c();
      let slug = slugifyGroup(input.name) || "groupe";
      while (d.groups.some((g) => g.slug === slug)) slug += "-" + Math.floor(Math.random() * 90 + 10);
      const g: ChatGroup = { id: randomUUID(), slug, ...input, createdBy: actorId, createdAt: nowIso(), archivedAt: null };
      d.groups.push(g);
      d.groupMembers.push({ groupId: g.id, profileId: actorId, status: "member", createdAt: nowIso(), decidedBy: actorId, decidedAt: nowIso() });
      return clone(g);
    },
    async updateGroup(id, input) {
      const g = c().groups.find((x) => x.id === id);
      if (!g) throw new Error("Groupe introuvable.");
      const { archived, ...rest } = input;
      Object.assign(g, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
      if (archived !== undefined) g.archivedAt = archived ? nowIso() : null;
      return clone(g);
    },
    async joinGroup(groupId, profileId) {
      const d = db();
      const g = d.communaute.groups.find((x) => x.id === groupId && !x.archivedAt);
      const p = d.profiles.find((x) => x.id === profileId);
      if (!g || !p || !inCircle(p)) throw new Error("Groupe introuvable.");
      const existing = d.communaute.groupMembers.find((m) => m.groupId === groupId && m.profileId === profileId);
      if (existing) return existing.status;
      if (!g.listed) throw new Error("Ce groupe est privé : il faut y être invitée.");
      const status = g.joinPolicy === "open" ? "member" : "pending";
      d.communaute.groupMembers.push({ groupId, profileId, status, createdAt: nowIso(), decidedBy: null, decidedAt: null });
      if (status === "pending")
        notifyModerators(d, "group_request", `Demande pour « ${g.name} »`, `${fullName(p)} souhaite rejoindre le groupe.`, profileId, {
          admin: "/fondatrices/communaute/groupes",
          moderator: "/espace/moderation?onglet=groupes",
        });
      return status;
    },
    async leaveGroup(groupId, profileId) {
      const d = c();
      d.groupMembers = d.groupMembers.filter((m) => !(m.groupId === groupId && m.profileId === profileId));
    },
    async listGroupMembers(groupId) {
      const d = db();
      return d.communaute.groupMembers
        .filter((m) => m.groupId === groupId)
        .map((m) => ({ profile: d.profiles.find((p) => p.id === m.profileId), status: m.status, createdAt: m.createdAt }))
        .filter((x): x is { profile: Profile; status: typeof x.status; createdAt: string } => !!x.profile)
        .map((x) => clone(x))
        .sort((a, b) => a.profile.firstName.localeCompare(b.profile.firstName, "fr"));
    },
    async listGroupRequests() {
      const d = db();
      return d.communaute.groupMembers
        .filter((m) => m.status === "pending")
        .map((m) => {
          const g = d.communaute.groups.find((x) => x.id === m.groupId);
          const p = d.profiles.find((x) => x.id === m.profileId);
          return g && p ? { group: clone(g), profileId: p.id, name: fullName(p), job: p.job, createdAt: m.createdAt } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },
    async decideGroupRequest(groupId, profileId, approve, actorId) {
      const all = db();
      const d = all.communaute;
      const m = d.groupMembers.find((x) => x.groupId === groupId && x.profileId === profileId && x.status === "pending");
      const g = d.groups.find((x) => x.id === groupId);
      if (!m || !g) return false;
      if (approve) {
        Object.assign(m, { status: "member", decidedBy: actorId, decidedAt: nowIso() });
        push(all, [{ recipientId: profileId, type: "group_joined", title: `Bienvenue dans « ${g.name} »`, body: "Ta demande est acceptée : tu peux écrire dans le groupe.", link: `/espace/cercle/groupes/${g.slug}` }]);
      } else d.groupMembers = d.groupMembers.filter((x) => x !== m);
      return true;
    },

    /* ---------- modération ---------- */
    async listKeywords() {
      return clone([...c().keywords].sort((a, b) => a.keyword.localeCompare(b.keyword, "fr")));
    },
    async addKeyword(keyword, action, actorId) {
      const d = c();
      const kw = normalizeKeyword(keyword);
      const existing = d.keywords.find((k) => k.keyword.toLowerCase() === kw.toLowerCase());
      if (existing) {
        existing.action = action;
        return clone(existing);
      }
      const k = { id: randomUUID(), keyword: kw, action, createdBy: actorId, createdAt: nowIso() };
      d.keywords.push(k);
      return clone(k);
    },
    async removeKeyword(id) {
      const d = c();
      const k = d.keywords.find((x) => x.id === id) ?? null;
      d.keywords = d.keywords.filter((x) => x.id !== id);
      return k ? clone(k) : null;
    },
    async applyKeywordModeration(message) {
      const d = db();
      const m = d.messages.find((x) => x.id === message.id);
      if (!m) return { hidden: false, flagged: [], reportIds: [] };
      const hits = matchKeywords(m.body, d.communaute.keywords);
      if (!hits.length) return { hidden: false, flagged: [], reportIds: [] };
      const toHide = hits.find((h) => h.action === "hide");
      if (toHide) hide(d, m, null, `Mot-clé « ${toHide.keyword} »`);
      const first = toHide ?? hits[0];
      const r = makeReport(d, m, {
        reporterId: null,
        source: "keyword",
        reason: toHide ? `Masqué automatiquement : « ${first.keyword} »` : `Mot-clé à vérifier : « ${first.keyword} »`,
        keyword: hits.map((h) => h.keyword).join(", "),
      });
      notifyReport(d, r);
      return { hidden: !!toHide, flagged: hits.map((h) => h.keyword), reportIds: [r.id] };
    },
    async getMessage(id) {
      const m = db().messages.find((x) => x.id === id);
      return m ? clone(m) : null;
    },
    async reportMessage(messageId, reporterId, reason) {
      const d = db();
      const m = d.messages.find((x) => x.id === messageId);
      if (!m || m.authorId === reporterId) return null;
      const already = d.communaute.reports.find((r) => r.messageId === messageId && r.reporterId === reporterId && r.status === "open");
      if (already) return clone(already);
      const r = makeReport(d, m, { reporterId, source: "member", reason, keyword: null });
      notifyReport(d, r);
      return clone(r);
    },
    async listReports(opts) {
      const status = opts?.status ?? "open";
      return clone(
        c()
          .reports.filter((r) => status === "all" || r.status === status)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, opts?.limit ?? 200),
      );
    },
    async countOpenReports() {
      return c().reports.filter((r) => r.status === "open").length;
    },
    async hideMessage(messageId, actorId, reason) {
      const d = db();
      const m = d.messages.find((x) => x.id === messageId);
      if (!m) return false;
      if (!m.hiddenAt) {
        hide(d, m, actorId, reason);
        if (!d.communaute.reports.some((r) => r.messageId === m.id)) {
          const r = makeReport(d, m, { reporterId: actorId, source: "moderator", reason, keyword: null });
          Object.assign(r, { status: "resolved", resolution: "hidden", resolvedBy: actorId, resolvedAt: nowIso() });
        }
      }
      return true;
    },
    async restoreMessage(messageId) {
      const d = db();
      const m = d.messages.find((x) => x.id === messageId);
      if (!m || !m.hiddenAt) return false;
      const orig = d.communaute.hiddenBodies.find((h) => h.messageId === messageId);
      if (orig) m.body = orig.body;
      m.hiddenAt = null;
      d.communaute.hiddenBodies = d.communaute.hiddenBodies.filter((h) => h.messageId !== messageId);
      return true;
    },
    async resolveReport(reportId, resolution, actorId) {
      const d = db();
      const r = d.communaute.reports.find((x) => x.id === reportId);
      if (!r) return null;
      Object.assign(r, { status: "resolved", resolution, resolvedBy: actorId, resolvedAt: nowIso() });
      if (resolution === "warned")
        push(d, [
          {
            recipientId: r.messageAuthorId,
            type: "moderation_warning",
            title: "Un mot de la modération",
            body: `Un de tes messages ne respecte pas la charte du club : « ${r.messageBody.slice(0, 120)} ». Merci d’y veiller.`,
            link: "/espace/cercle",
          },
        ]);
      return clone(r);
    },

    /* ---------- annuaire ---------- */
    async listDirectoryEntries(viewer, { admin }) {
      const d = db();
      return d.profiles
        .filter(inCircle)
        .filter((p) => p.id !== viewer.id)
        .map((p) => toDirectoryEntry(p, d.communaute.directory.find((x) => x.profileId === p.id) ?? null, { self: false, admin, founder: isAdmin(p) }))
        .filter((e): e is NonNullable<typeof e> => !!e)
        .sort((a, b) => (a.badge === "Fondatrice") === (b.badge === "Fondatrice") ? a.firstName.localeCompare(b.firstName, "fr") : a.badge === "Fondatrice" ? -1 : 1);
    },
    async getDirectoryProfile(profileId) {
      const dp = c().directory.find((x) => x.profileId === profileId);
      return dp ? clone(dp) : null;
    },
    async updateOwnProfile(profileId, input) {
      const d = db();
      const p = d.profiles.find((x) => x.id === profileId);
      if (!p) throw new Error("Fiche introuvable.");
      Object.assign(p, {
        firstName: input.firstName,
        lastName: input.lastName,
        job: input.job,
        country: input.country,
        marrakechSince: input.marrakechSince,
        bio: input.bio,
        whatsapp: input.whatsapp,
        avatarUrl: input.avatarUrl,
      });
      let dp = d.communaute.directory.find((x) => x.profileId === profileId);
      if (!dp) {
        dp = emptyDirectoryProfile(profileId, nowIso());
        d.communaute.directory.push(dp);
      }
      Object.assign(dp, {
        company: input.company,
        sector: input.sector,
        skills: input.skills,
        instagram: input.instagram,
        linkedin: input.linkedin,
        website: input.website,
        lookingFor: input.lookingFor,
        offering: input.offering,
        visibility: input.visibility,
        showWhatsapp: input.showWhatsapp,
        showEmail: input.showEmail,
        updatedAt: nowIso(),
      });
    },

    /* ---------- rappels J-1 ---------- */
    async listReminderTargets(eventId) {
      const d = db();
      const sent = new Set(d.communaute.remindersSent.filter((r) => r.eventId === eventId).map((r) => r.profileId));
      const ids = d.bookings
        .filter((b) => b.eventId === eventId && b.profileId && ["paid", "offered", "pending"].includes(b.status))
        .map((b) => b.profileId as string)
        .filter((id) => !sent.has(id));
      return [...new Set(ids)];
    },
    async markRemindersSent(eventId, profileIds) {
      const d = c();
      const at = nowIso();
      profileIds.forEach((profileId) => {
        if (!d.remindersSent.some((r) => r.eventId === eventId && r.profileId === profileId)) d.remindersSent.push({ eventId, profileId, sentAt: at });
      });
    },
  };
}

/** Utilisé par le mode démo pour savoir si un message est dans un groupe dont la personne fait partie. */
export function demoCanReadGroup(d: SeedData, channel: string, profileId: string): boolean {
  const gid = groupIdOfChannel(channel);
  if (!gid) return true;
  return d.communaute.groupMembers.some((m) => m.groupId === gid && m.profileId === profileId && m.status === "member");
}
