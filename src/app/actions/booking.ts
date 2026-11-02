"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { TicketData } from "@/components/ui/Ticket";
import { getViewer, TICKETS_COOKIE } from "@/lib/auth";
import { today, ymdOf } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { priceFor } from "@/lib/domain/events";
import { paymentMode } from "@/lib/env";
import { bookingConfirmed, waitlistSpot } from "@/lib/notify";
import { claimReferral } from "@/lib/modules/engagement/referral"; // --- Lot 4 ---
import { inCircle } from "@/lib/permissions";
import { guestSchema } from "@/lib/validation";
import { ticketData } from "@/lib/views";

export type ReserveInput = { eventId: string; firstName?: string; whatsapp?: string; wait?: boolean; referralCode?: string /* --- Lot 4 --- */ };

export type ReserveResult =
  | { ok: true; kind: "booked"; ticket: TicketData; name: string; phone: string | null; pending: boolean; already: boolean }
  | { ok: true; kind: "waitlist"; position: number; name: string; phone: string | null; eventTitle: string }
  | { ok: false; error: string; field?: "firstName" | "whatsapp" };

async function rememberGuestTicket(code: string) {
  const jar = await cookies();
  const list = (jar.get(TICKETS_COOKIE)?.value ?? "").split(",").filter(Boolean);
  if (!list.includes(code)) list.push(code);
  jar.set(TICKETS_COOKIE, list.slice(-20).join(","), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/**
 * Réserver une place (ou rejoindre la liste d'attente).
 * Le prix est toujours calculé ici, selon la formule de la personne.
 * Paiement : simulé en démo, virement déclaré en mode réel sans Stripe.
 * Avec Stripe, une place payante passe par /api/checkout.
 */
export async function reserve(input: ReserveInput): Promise<ReserveResult> {
  const viewer = await getViewer();
  const repo = getRepo();
  const ev = await repo.getEventById(input.eventId);
  if (!ev || ev.status !== "published" || ymdOf(ev.startsAt) < today()) return { ok: false, error: "Ce rendez-vous n’est plus ouvert aux réservations." };

  let profile = viewer.profile;
  let guestFirstName: string | null = null;
  let guestWhatsapp: string | null = null;
  if (!profile) {
    const parsed = guestSchema.safeParse({ firstName: input.firstName ?? "", whatsapp: input.whatsapp ?? "" });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue.message, field: issue.path[0] === "whatsapp" ? "whatsapp" : "firstName" };
    }
    guestFirstName = parsed.data.firstName;
    guestWhatsapp = parsed.data.whatsapp;
    // En démo, le compte gratuit se crée à la première réservation (prénom + WhatsApp).
    if (viewer.mode === "demo") {
      profile = await repo.createGuestProfile({ firstName: guestFirstName, lastName: "", whatsapp: guestWhatsapp, email: null });
      guestFirstName = null;
      guestWhatsapp = null;
    }
  }

  // --- Lot 4 --- : inscription parrainée (code saisi ou ?parrain=CODE mémorisé)
  if (profile && !inCircle(profile)) await claimReferral(profile.id, input.referralCode);

  const plan = viewer.profile ? viewer.profile.plan : "free";
  const price = priceFor(ev, plan);
  if (price === null && !input.wait) return { ok: false, error: "Ce rendez-vous est réservé aux Premium." };
  const amount = price ?? 0;
  const mode = paymentMode();
  if (amount > 0 && !input.wait && mode === "stripe") return { ok: false, error: "Le paiement passe par Stripe." };

  const result = await repo.bookEvent({
    eventId: ev.id,
    profileId: profile?.id ?? null,
    guestFirstName,
    guestWhatsapp,
    amount,
    method: amount === 0 ? "free" : mode === "transfer" ? "transfer" : "card",
    initialStatus: amount === 0 ? (ev.premiumFree ? "offered" : "paid") : mode === "transfer" ? "pending" : "paid",
    declareTransfer: amount > 0 && mode === "transfer",
    waitlistIfFull: Boolean(input.wait),
  });

  if (result.status === "full") return { ok: false, error: "C’est complet. Inscris-toi sur la liste d’attente." };
  if (!viewer.profile) await rememberGuestTicket(result.booking.ticketCode);
  revalidateAll();

  const name = profile?.firstName ?? guestFirstName ?? "";
  const phone = profile?.whatsapp ?? guestWhatsapp;
  if (result.status === "waitlist" || (result.status === "already" && result.booking.status === "waitlist")) {
    const fresh = await repo.getEventById(ev.id);
    return { ok: true, kind: "waitlist", position: result.status === "waitlist" ? result.position : fresh?.stats.waitlist ?? 1, name, phone, eventTitle: ev.title };
  }
  const view = await repo.getBookingByCode(result.booking.ticketCode);
  if (!view) return { ok: false, error: "Réservation introuvable." };
  if (profile && result.status === "booked") await bookingConfirmed(profile, view.event, view.ticketCode, view.status === "pending");
  return { ok: true, kind: "booked", ticket: await ticketData(view), name, phone, pending: view.status === "pending", already: result.status === "already" };
}

/** Annuler sa réservation (personne connectée). */
export async function cancelMyBooking(bookingId: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer.profile) return { ok: false };
  const repo = getRepo();
  const { eventId, waitlistProfileId } = await repo.cancelBooking(bookingId, viewer.profile.id);
  if (eventId && waitlistProfileId) {
    const [ev, next] = await Promise.all([repo.getEventById(eventId), repo.getProfile(waitlistProfileId)]);
    if (ev) await waitlistSpot(waitlistProfileId, ev, next ? inCircle(next) : false);
  }
  revalidateAll();
  return { ok: true };
}
