/**
 * Couche de notifications.
 * Aujourd'hui : notifications in-app (table notifications), en respectant les préférences de chacune.
 * Demain : le même appel pourra aussi envoyer un e-mail ou une notification push (voir `deliverExternally`).
 * Une notification qui échoue ne doit jamais faire échouer l'action qui l'a déclenchée.
 */
import { getRepo } from "./data";
import type { NotificationInput } from "./data/repo";
import { dayMonthShort, money } from "./format";
import { inCircle, ROLE_LABEL } from "./permissions";
import { ENGAGEMENT_NOTIFICATION_LABEL } from "./modules/engagement/labels"; // --- Lot 4 ---
import { PAIEMENTS_NOTIFICATION_LABEL } from "./modules/paiements/labels"; // --- Vague 2 · paiements ---
import type { ClubEvent, GrantableRole, NotificationType, Payment, Profile } from "./types";

export const NOTIFICATION_LABEL: Record<NotificationType, { label: string; hint: string }> = {
  booking_confirmed: { label: "Réservations", hint: "Confirmation de ta place et de ton billet." },
  waitlist_spot: { label: "Liste d’attente", hint: "Une place se libère sur un rendez-vous complet." },
  event_published: { label: "Nouveaux rendez-vous", hint: "Un rendez-vous vient d’être publié." },
  payment_validated: { label: "Paiements", hint: "Ton virement est validé par les fondatrices." },
  role_changed: { label: "Accès", hint: "Un nouvel espace s’ouvre sur ton compte." },
  // --- Lot 5 ---
  crm_task_due: { label: "Tâches du CRM", hint: "Rappel des tâches du jour ou en retard, tâche assignée par l’autre fondatrice." },
  // --- Lot 4 ---
  ...ENGAGEMENT_NOTIFICATION_LABEL,
  // --- Lot 1 ---
  news_published: { label: "Actualités du club", hint: "Une nouvelle publication des fondatrices." },
  event_reminder: { label: "Rappels", hint: "La veille d’un rendez-vous où tu es inscrite." },
  group_request: { label: "Demandes de groupe", hint: "Une membre demande à rejoindre un groupe (modération)." },
  group_joined: { label: "Groupes", hint: "Ta demande pour rejoindre un groupe est acceptée." },
  moderation_report: { label: "Signalements", hint: "Un message est signalé ou repéré par un mot-clé (modération)." },
  moderation_warning: { label: "Messages de la modération", hint: "Un avertissement sur l’un de tes messages." },
  // --- Vague 2 · paiements ---
  ...PAIEMENTS_NOTIFICATION_LABEL,
};

/** Types réservés à l'équipe (masqués des préférences des membres). */
export const STAFF_NOTIFICATION_TYPES: NotificationType[] = ["crm_task_due"];

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_LABEL) as NotificationType[];

/** Point d'entrée unique : enregistre puis (plus tard) relaie par e-mail / push. */
export async function notify(rows: NotificationInput[]): Promise<number> {
  if (!rows.length) return 0;
  try {
    const n = await getRepo().createNotifications(rows);
    await deliverExternally(rows);
    return n;
  } catch (e) {
    console.error("[notify]", e instanceof Error ? e.message : e);
    return 0;
  }
}

/**
 * Canaux externes (e-mail, push) : branchés dans un lot suivant.
 * Les préférences `email` / `push` de notification_prefs seront lues ici.
 */
async function deliverExternally(rows: NotificationInput[]): Promise<void> {
  // --- Lot 6 --- notifications push Web (désactivées sans clés VAPID ; préférence « push » respectée)
  const { deliverPush } = await import("./modules/securite/push");
  await deliverPush(rows);
}

const eventLink = (e: Pick<ClubEvent, "slug">, member: boolean) => (member ? `/espace/agenda/${e.slug}` : `/rendez-vous/${e.slug}`);

export function bookingConfirmed(p: Profile, e: ClubEvent, ticketCode: string, pending: boolean) {
  return notify([
    {
      recipientId: p.id,
      type: "booking_confirmed",
      title: pending ? "Ta place est retenue" : "Ta place est réservée",
      body: `${e.title}, ${dayMonthShort(e.startsAt)}${e.venue ? ` · ${e.venue}` : ""}. Ton billet : ${ticketCode}.${pending ? " Elle sera confirmée dès réception du paiement." : ""}`,
      link: inCircle(p) ? eventLink(e, true) : `/billet/${ticketCode}`,
    },
  ]);
}

export function waitlistSpot(profileId: string, e: ClubEvent, member: boolean) {
  return notify([
    {
      recipientId: profileId,
      type: "waitlist_spot",
      title: "Une place s’est libérée",
      body: `${e.title}, ${dayMonthShort(e.startsAt)} : une place vient de se libérer. Réserve-la vite, elle est à la première qui la prend.`,
      link: eventLink(e, member),
    },
  ]);
}

export function eventPublished(e: ClubEvent, recipients: Profile[], actorId: string) {
  return notify(
    recipients
      .filter((p) => p.id !== actorId)
      .map((p) => ({
        recipientId: p.id,
        type: "event_published" as const,
        title: `Nouveau rendez-vous : ${e.shortTitle ?? e.title}`,
        body: `${dayMonthShort(e.startsAt)}${e.venue ? ` · ${e.venue}` : ""}. Les places sont ouvertes.`,
        link: eventLink(e, true),
      })),
  );
}

export function paymentValidated(pay: Payment) {
  if (!pay.profileId) return Promise.resolve(0);
  return notify([
    {
      recipientId: pay.profileId,
      type: "payment_validated",
      title: "Virement validé",
      body: `${pay.kind === "membership" ? "Ton adhésion est active" : "Ta place est confirmée"} · ${money(pay.amount)} reçus. Merci !`,
      link: pay.kind === "membership" ? "/espace/moi" : "/espace/agenda",
    },
  ]);
}

const SPACE_LINK: Partial<Record<GrantableRole, string>> = { member: "/espace", partner: "/partenaire", pro: "/pro", admin: "/fondatrices" };

export function roleGranted(profileId: string, role: GrantableRole) {
  return notify([
    {
      recipientId: profileId,
      type: "role_changed",
      title: `Nouvel accès : ${ROLE_LABEL[role]}`,
      body: "Les fondatrices ont ouvert un nouvel accès sur ton compte.",
      link: SPACE_LINK[role] ?? null,
    },
  ]);
}

// --- Lot 6 --- un accès retiré est aussi signalé (sécurité des comptes)
export function roleRevoked(profileId: string, role: GrantableRole) {
  return notify([
    {
      recipientId: profileId,
      type: "role_changed",
      title: `Accès retiré : ${ROLE_LABEL[role]}`,
      body: "Les fondatrices ont retiré cet accès de ton compte. Si tu ne comprends pas pourquoi, écris-leur.",
      link: null,
    },
  ]);
}
