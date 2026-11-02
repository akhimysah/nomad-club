import { nowMs } from "./clock";
import { getRepo } from "./data";
import { messageTime } from "./format";
import { NOTIFICATION_LABEL, NOTIFICATION_TYPES, STAFF_NOTIFICATION_TYPES } from "./notify";
import { ENGAGEMENT_NOTIFICATION_ICON } from "./modules/engagement/labels"; // --- Lot 4 ---
import type { NotificationType } from "./types";
import type { IconName } from "@/components/IconSprite";

export const NOTIFICATION_ICON: Record<NotificationType, IconName> = {
  booking_confirmed: "ticket",
  waitlist_spot: "clock",
  event_published: "cal",
  payment_validated: "wallet",
  role_changed: "lock",
  // --- Lot 5 ---
  crm_task_due: "check",
  // --- Lot 4 ---
  ...ENGAGEMENT_NOTIFICATION_ICON,
  // --- Lot 1 ---
  news_published: "star",
  event_reminder: "bell",
  group_request: "users",
  group_joined: "chat",
  moderation_report: "inbox",
  moderation_warning: "x",
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  icon: IconName;
  title: string;
  body: string;
  link: string | null;
  unread: boolean;
  time: string;
};

export type PrefItem = { type: NotificationType; label: string; hint: string; inApp: boolean; email: boolean };

/** Notifications et préférences de la personne, prêtes à afficher. */
export async function loadNotifications(profileId: string, opts: { staff?: boolean } = {}): Promise<{ items: NotificationItem[]; unread: number; prefs: PrefItem[] }> {
  const repo = getRepo();
  const [list, prefs] = await Promise.all([repo.listNotifications(profileId, 60), repo.listNotificationPrefs(profileId)]);
  const now = nowMs();
  const items = list.map((n) => ({
    id: n.id,
    type: n.type,
    icon: NOTIFICATION_ICON[n.type],
    title: n.title,
    body: n.body,
    link: n.link,
    unread: !n.readAt,
    time: messageTime(n.createdAt, now),
  }));
  return {
    items,
    unread: items.filter((i) => i.unread).length,
    prefs: NOTIFICATION_TYPES.filter((t) => opts.staff || !STAFF_NOTIFICATION_TYPES.includes(t)).map((t) => {
      const p = prefs.find((x) => x.type === t);
      return { type: t, ...NOTIFICATION_LABEL[t], inApp: p?.inApp ?? true, email: p?.email ?? true };
    }),
  };
}
