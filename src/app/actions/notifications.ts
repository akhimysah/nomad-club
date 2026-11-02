"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { NOTIFICATION_TYPES } from "@/lib/notify";
import type { NotificationChannel, NotificationType } from "@/lib/types";

/** Marque des notifications (ou toutes) comme lues pour la personne connectée. */
export async function markNotificationsReadAction(ids: string[] | "all"): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v.profile) return { ok: false };
  const list = ids === "all" ? "all" : ids.filter((x) => typeof x === "string").slice(0, 100);
  await getRepo().markNotificationsRead(v.profile.id, list);
  revalidatePath("/", "layout");
  return { ok: true };
}

const CHANNELS: NotificationChannel[] = ["inApp", "email", "push"];

/** Active ou coupe un type de notification sur un canal. */
export async function setNotificationPrefAction(type: NotificationType, channel: NotificationChannel, enabled: boolean): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v.profile || !NOTIFICATION_TYPES.includes(type) || !CHANNELS.includes(channel)) return { ok: false };
  await getRepo().setNotificationPref(v.profile.id, type, channel, Boolean(enabled));
  revalidatePath("/", "layout");
  return { ok: true };
}
