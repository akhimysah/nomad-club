"use server";

import type { TicketData } from "@/components/ui/Ticket";
import { getViewer } from "@/lib/auth";
import { today, ymdOf } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { answerQuestion, type AiAnswer } from "@/lib/domain/assistant";
import { ticketData, viewerBookings } from "@/lib/views";

export type AssistantReply = AiAnswer & { ticket: TicketData | null };

/** Question posée à l'assistant du club : réponse par règles, à partir des vraies données. */
export async function askAssistant(question: string): Promise<AssistantReply> {
  const q = question.trim().slice(0, 300);
  const viewer = await getViewer();
  const repo = getRepo();
  const t = today();
  const [places, events, directory, offers, bookings] = await Promise.all([
    repo.listPlaces(),
    repo.listEvents({ status: "published", fromYmd: t }),
    repo.listDirectory(),
    repo.listPartnerOffers(),
    viewerBookings(viewer),
  ]);
  const nextBooking =
    bookings.filter((b) => ["paid", "offered", "pending"].includes(b.status) && ymdOf(b.event.startsAt) >= t).sort((a, b) => (a.event.startsAt < b.event.startsAt ? -1 : 1))[0] ?? null;
  const a = answerQuestion(q || "?", { plan: viewer.profile?.plan ?? "free", places, events, nextBooking, directory: directory.filter((p) => p.id !== viewer.profile?.id), offers });
  return { ...a, ticket: a.actions.some((x) => x.ticket) && nextBooking ? await ticketData(nextBooking) : null };
}
