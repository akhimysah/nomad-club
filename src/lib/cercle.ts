import type { DirPerson, ThreadItem } from "@/components/member/Cercle";
import { toChatMsg, type ChatMsg } from "./chat";
import { nowMs, today, ymdOf } from "./clock";
import { getRepo } from "./data";
import { dmChannel } from "./data/repo";
import { daysBetween } from "./clock";
import { dayMonthShort, fullName, messageTime } from "./format";
import type { Profile } from "./types";
import { hasRole, isAdmin } from "./permissions";
import { HIDDEN_LABEL } from "./modules/communaute/domain";
import { groupItems } from "./modules/communaute/views";

export function dirPerson(p: Profile): DirPerson {
  return {
    id: p.id,
    name: fullName(p),
    firstName: p.firstName,
    job: p.job ?? "Membre du club",
    country: p.country ?? "Marrakech",
    since: p.marrakechSince,
    badge: isAdmin(p) ? "Fondatrice" : p.plan === "premium" ? "Premium" : null,
  };
}

/** Données du Cercle pour une adhérente (salon, groupes, annuaire, conversations, éventuellement un fil ouvert). */
export async function loadCercle(me: Profile, otherId: string | null) {
  const repo = getRepo();
  const t = today();
  const [salonRaw, dir, threadsRaw, entries, groups] = await Promise.all([
    repo.listMessages("general"),
    repo.listDirectory(),
    repo.listDmThreads(me.id),
    // --- Lot 1 --- annuaire avec confidentialité, groupes thématiques
    repo.listDirectoryEntries(me, { admin: isAdmin(me) }),
    repo.listGroups(me.id),
  ]);
  const directory = dir.filter((p) => p.id !== me.id);
  const activeMembers = dir.filter((p) => hasRole(p, "member") && p.plan !== "free" && p.planEndsAt && p.planEndsAt >= t);
  const salon: ChatMsg[] = salonRaw.map((m) => toChatMsg(m, m.author, me.id));
  const last = salonRaw[salonRaw.length - 1];
  const d = last ? daysBetween(ymdOf(last.createdAt), t) : 0;
  const salonDay = d <= 0 ? "Aujourd’hui" : d === 1 ? "Hier" : last ? dayMonthShort(last.createdAt) : "Aujourd’hui";
  const threads: ThreadItem[] = threadsRaw.map((th) => ({
    id: th.other.id,
    name: fullName(th.other),
    last: th.last?.hiddenAt ? HIDDEN_LABEL : (th.last?.body ?? ""),
    lastMine: th.last?.authorId === me.id,
    unread: th.unread > 0,
    time: th.last ? messageTime(th.last.createdAt, nowMs()) : "",
  }));
  let thread: { other: DirPerson; messages: ChatMsg[] } | null = null;
  if (otherId) {
    const other = directory.find((p) => p.id === otherId);
    if (!other) return null;
    const msgs = await repo.listMessages(dmChannel(me.id, other.id));
    thread = { other: dirPerson(other), messages: msgs.map((m) => toChatMsg(m, m.author, me.id)) };
  }
  return {
    salon,
    salonDay,
    directory: directory.map(dirPerson),
    entries,
    groups: groupItems(groups),
    threads,
    thread,
    activeCount: activeMembers.length,
    premiumCount: activeMembers.filter((p) => p.plan === "premium").length,
  };
}
