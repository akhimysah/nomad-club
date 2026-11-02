/**
 * Lot 1 — Communauté : préparation des données des pages (côté serveur).
 */
import type { NewsItem } from "@/components/communaute/NewsFeed";
import { nowMs } from "../../clock";
import { getRepo } from "../../data";
import { dayMonthLong, fullName, messageTime } from "../../format";
import type { Profile } from "../../types";
import { groupIdOfChannel } from "./domain";
import type { GroupView, NewsPostView, ReportView } from "./types";

export function newsItems(posts: NewsPostView[]): NewsItem[] {
  return posts.map((p) => ({ ...p, dateLabel: p.publishedAt ? dayMonthLong(p.publishedAt) : `brouillon du ${dayMonthLong(p.updatedAt)}` }));
}

/** Élément d'une liste de groupes, prêt à afficher. */
export type GroupItem = GroupView & { lastLabel: string | null };

export function groupItems(groups: GroupView[]): GroupItem[] {
  const now = nowMs();
  return groups.map((g) => ({ ...g, lastLabel: g.lastMessageAt ? messageTime(g.lastMessageAt, now) : null }));
}

/** File de modération : signalements avec noms, canal lisible et état du message. */
export async function loadReports(status: "open" | "resolved" | "all", viewerId: string): Promise<ReportView[]> {
  const repo = getRepo();
  const [reports, profiles, groups] = await Promise.all([repo.listReports({ status, limit: 100 }), repo.listDirectory(), repo.listGroups(viewerId, { manage: true })]);
  const names = new Map<string, Profile>(profiles.map((p) => [p.id, p]));
  const missing = [...new Set(reports.flatMap((r) => [r.messageAuthorId, r.reporterId]).filter((id): id is string => !!id && !names.has(id)))];
  for (const id of missing) {
    const p = await repo.getProfile(id);
    if (p) names.set(id, p);
  }
  const messages = await Promise.all(reports.map((r) => repo.getMessage(r.messageId)));
  const label = (channel: string) => {
    if (channel === "general") return "Salon Général";
    const gid = groupIdOfChannel(channel);
    if (gid) return `Groupe « ${groups.find((g) => g.id === gid)?.name ?? "?"} »`;
    return "Message privé";
  };
  return reports.map((r, i) => {
    const author = names.get(r.messageAuthorId);
    const reporter = r.reporterId ? names.get(r.reporterId) : null;
    return {
      ...r,
      authorName: author ? fullName(author) : "Membre",
      reporterName: reporter ? fullName(reporter) : null,
      channelLabel: label(r.channel),
      hidden: Boolean(messages[i]?.hiddenAt),
    };
  });
}

export type GroupRequestItem = { groupId: string; groupName: string; profileId: string; name: string; job: string | null; time: string };

/** File de modération prête à afficher (à traiter, déjà traités, mots-clés, demandes de groupe). */
export async function loadModeration(viewerId: string) {
  const repo = getRepo();
  const now = nowMs();
  const [open, done, keywords, requests] = await Promise.all([loadReports("open", viewerId), loadReports("resolved", viewerId), repo.listKeywords(), repo.listGroupRequests()]);
  const item = (r: ReportView) => ({ ...r, time: messageTime(r.createdAt, now), resolvedLabel: r.resolvedAt ? messageTime(r.resolvedAt, now) : null });
  return {
    open: open.map(item),
    resolved: done.slice(0, 12).map(item),
    keywords,
    requests: requests.map((q): GroupRequestItem => ({ groupId: q.group.id, groupName: q.group.name, profileId: q.profileId, name: q.name, job: q.job, time: messageTime(q.createdAt, now) })),
  };
}
