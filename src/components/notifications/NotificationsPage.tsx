import { getViewer, viewerCan } from "@/lib/auth";
import { loadNotifications } from "@/lib/notifications-view";
import { NotificationCenter } from "./NotificationCenter";

/** Contenu de la page Notifications, commun à tous les espaces. */
export async function NotificationsBody({ profileId }: { profileId: string }) {
  // Lot 5 : les préférences réservées à l'équipe (tâches du CRM) n'apparaissent qu'à qui a accès au CRM
  const staff = viewerCan(await getViewer(), "crm.access");
  const { items, prefs } = await loadNotifications(profileId, { staff });
  return <NotificationCenter items={items} prefs={prefs} />;
}
