import { loadNotifications } from "@/lib/notifications-view";
import { NotificationCenter } from "./NotificationCenter";

/** Contenu de la page Notifications, commun à tous les espaces. */
export async function NotificationsBody({ profileId }: { profileId: string }) {
  const { items, prefs } = await loadNotifications(profileId);
  return <NotificationCenter items={items} prefs={prefs} />;
}
