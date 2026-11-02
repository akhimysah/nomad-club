/**
 * Lot 1 — Communauté : opérations côté serveur qui combinent données, notifications et journal
 * (appelées par les server actions et la route du cron). Les gardes d'accès sont faites avant l'appel.
 */
import { addDays, today, ymdOf } from "../../clock";
import { getRepo } from "../../data";
import { dayMonthShort, hour } from "../../format";
import { notify } from "../../notify";
import { inCircle } from "../../permissions";
import type { ClubEvent } from "../../types";
import type { NewsPost } from "./types";

/** Notification « nouvelle publication » à tout le cercle (sauf l'autrice). */
export async function notifyNewsPublished(post: NewsPost, actorId: string): Promise<number> {
  const members = (await getRepo().listDirectory()).filter((p) => inCircle(p) && p.id !== actorId);
  const excerpt = post.body.replace(/\s+/g, " ").trim();
  return notify(
    members.map((p) => ({
      recipientId: p.id,
      type: "news_published" as const,
      title: post.title.slice(0, 160),
      body: excerpt.length > 140 ? excerpt.slice(0, 139) + "…" : excerpt,
      link: `/espace/actualites#post-${post.id}`,
    })),
  );
}

export type ReminderRun = { day: string; events: Array<{ id: string; title: string; sent: number }>; total: number };

function reminderText(e: ClubEvent) {
  return {
    title: `Demain : ${e.shortTitle ?? e.title}`,
    body: `${dayMonthShort(e.startsAt)} à ${hour(e.startsAt)}${e.venue ? ` · ${e.venue}` : ""}${e.address ? `, ${e.address}` : ""}. Ton billet est dans l’appli. À demain !`,
  };
}

/**
 * Rappels J-1 : prévient les inscrites (réservation payée, offerte ou en attente de paiement) des rendez-vous de demain,
 * une seule fois par personne. `eventId` : envoie tout de suite le rappel d'un rendez-vous précis (bouton des fondatrices).
 */
export async function sendEventReminders(opts: { eventId?: string } = {}): Promise<ReminderRun> {
  const repo = getRepo();
  const day = addDays(today(), 1);
  let events: ClubEvent[];
  if (opts.eventId) {
    const ev = await repo.getEventById(opts.eventId);
    events = ev && ev.status === "published" && ymdOf(ev.startsAt) >= today() ? [ev] : [];
  } else {
    events = (await repo.listEvents({ status: "published", fromYmd: day })).filter((e) => ymdOf(e.startsAt) === day);
  }
  const out: ReminderRun = { day, events: [], total: 0 };
  for (const e of events) {
    const targets = await repo.listReminderTargets(e.id);
    const { title, body } = reminderText(e);
    if (targets.length) {
      await notify(targets.map((recipientId) => ({ recipientId, type: "event_reminder" as const, title, body, link: `/espace/agenda/${e.slug}` })));
      await repo.markRemindersSent(e.id, targets);
    }
    out.events.push({ id: e.id, title: e.title, sent: targets.length });
    out.total += targets.length;
  }
  return out;
}
