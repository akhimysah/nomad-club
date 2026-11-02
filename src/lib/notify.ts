/**
 * Couche de notifications.
 * Notifications in-app (table notifications), en respectant les préférences de chacune, relayées par
 * e-mail (vague 2) et push Web (Lot 6) dans `deliverExternally`.
 * Une notification qui échoue ne doit jamais faire échouer l'action qui l'a déclenchée.
 */
import { getRepo } from "./data";
import type { NotificationInput } from "./data/repo";
import { dayLong, dayMonthShort, hour, money } from "./format";
import { inCircle, ROLE_LABEL } from "./permissions";
import { ENGAGEMENT_NOTIFICATION_LABEL } from "./modules/engagement/labels"; // --- Lot 4 ---
import { CONTRATS_NOTIFICATION_LABEL } from "./modules/contrats/labels"; // --- Vague 2 · Contrats ---
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
  // --- Vague 2 · Contrats ---
  ...CONTRATS_NOTIFICATION_LABEL,
  // --- Vague 2 · paiements ---
  ...PAIEMENTS_NOTIFICATION_LABEL,
};

/** Types réservés à l'équipe (masqués des préférences des membres). */
export const STAFF_NOTIFICATION_TYPES: NotificationType[] = ["crm_task_due"];

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_LABEL) as NotificationType[];

/** Point d'entrée unique : enregistre puis relaie par e-mail / push. */
export async function notify(rows: NotificationInput[]): Promise<number> {
  return notifyWith(rows);
}

/**
 * --- E-mails --- comme `notify`, avec des données riches par ligne pour l'e-mail (billet, date mise en forme…).
 * Interne à ce fichier : l'interface publique reste `notify(rows)`.
 */
async function notifyWith(rows: NotificationInput[], emailExtras?: Array<Record<string, unknown> | undefined>): Promise<number> {
  if (!rows.length) return 0;
  try {
    const n = await getRepo().createNotifications(rows);
    await deliverExternally(rows, emailExtras);
    return n;
  } catch (e) {
    console.error("[notify]", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Canaux externes : e-mail (préférence `email`, sauf essentiels) et push (préférence `push`). Jamais bloquants. */
async function deliverExternally(rows: NotificationInput[], emailExtras?: Array<Record<string, unknown> | undefined>): Promise<void> {
  // --- E-mails --- (src/lib/modules/emails : Resend, ou console sans clé)
  try {
    const { deliverNotificationEmails } = await import("./modules/emails/notify-channel");
    await deliverNotificationEmails(rows, emailExtras);
  } catch (e) {
    console.error("[notify] e-mail :", e instanceof Error ? e.message : e);
  }
  // --- Lot 6 --- notifications push Web (désactivées sans clés VAPID ; préférence « push » respectée)
  const { deliverPush } = await import("./modules/securite/push");
  await deliverPush(rows);
}

// --- E-mails --- données d'un rendez-vous pour les modèles d'e-mail
function eventEmailData(e: ClubEvent, member: boolean): Record<string, unknown> {
  return {
    eventId: e.id,
    eventSlug: e.slug,
    eventTitle: e.title,
    dateLabel: `${dayLong(e.startsAt)} à ${hour(e.startsAt)}`,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venue: e.venue ?? "",
    address: e.address ?? "",
    description: e.description,
    eventUrl: eventLink(e, member),
  };
}

const eventLink = (e: Pick<ClubEvent, "slug">, member: boolean) => (member ? `/espace/agenda/${e.slug}` : `/rendez-vous/${e.slug}`);

export function bookingConfirmed(p: Profile, e: ClubEvent, ticketCode: string, pending: boolean) {
  const emailData = { ...eventEmailData(e, inCircle(p)), ticketCode, pending, ticketUrl: `/billet/${ticketCode}` };
  return notifyWith([
    {
      recipientId: p.id,
      type: "booking_confirmed",
      title: pending ? "Ta place est retenue" : "Ta place est réservée",
      body: `${e.title}, ${dayMonthShort(e.startsAt)}${e.venue ? ` · ${e.venue}` : ""}. Ton billet : ${ticketCode}.${pending ? " Elle sera confirmée dès réception du paiement." : ""}`,
      link: inCircle(p) ? eventLink(e, true) : `/billet/${ticketCode}`,
    },
  ], [emailData]);
}

export function waitlistSpot(profileId: string, e: ClubEvent, member: boolean) {
  return notifyWith([
    {
      recipientId: profileId,
      type: "waitlist_spot",
      title: "Une place s’est libérée",
      body: `${e.title}, ${dayMonthShort(e.startsAt)} : une place vient de se libérer. Réserve-la vite, elle est à la première qui la prend.`,
      link: eventLink(e, member),
    },
  ], [eventEmailData(e, member)]);
}

export function eventPublished(e: ClubEvent, recipients: Profile[], actorId: string) {
  const targets = recipients.filter((p) => p.id !== actorId);
  const priceLabel = e.premiumFree ? "Offert aux Premium" : e.priceMember || e.pricePublic ? `${money(e.priceMember)} membre · ${money(e.pricePublic)} public` : "Gratuit";
  return notifyWith(
    targets.map((p) => ({
        recipientId: p.id,
        type: "event_published" as const,
        title: `Nouveau rendez-vous : ${e.shortTitle ?? e.title}`,
        body: `${dayMonthShort(e.startsAt)}${e.venue ? ` · ${e.venue}` : ""}. Les places sont ouvertes.`,
        link: eventLink(e, true),
      })),
    targets.map(() => ({ ...eventEmailData(e, true), priceLabel })),
  );
}

export function paymentValidated(pay: Payment) {
  if (!pay.profileId) return Promise.resolve(0);
  const label = pay.kind === "membership" ? `Adhésion ${pay.plan === "premium" ? "Premium" : "Membre"}` : "Réservation d’un rendez-vous";
  const receipt = {
    amount: money(pay.amount),
    label,
    method: pay.method === "transfer" ? "Virement" : pay.method === "card" ? "Carte bancaire" : "Offert",
    paidAt: dayMonthShort(pay.validatedAt ?? pay.declaredAt),
    reference: pay.id.slice(0, 8).toUpperCase(),
    link: pay.kind === "membership" ? "/espace/moi" : "/espace/agenda",
  };
  return notifyWith([
    {
      recipientId: pay.profileId,
      type: "payment_validated",
      title: "Virement validé",
      body: `${pay.kind === "membership" ? "Ton adhésion est active" : "Ta place est confirmée"} · ${money(pay.amount)} reçus. Merci !`,
      link: pay.kind === "membership" ? "/espace/moi" : "/espace/agenda",
    },
  ], [receipt]);
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
