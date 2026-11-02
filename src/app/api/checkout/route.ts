import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer, TICKETS_COOKIE } from "@/lib/auth";
import { today, ymdOf } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { priceFor } from "@/lib/domain/events";
import { membershipAmount } from "@/lib/domain/membership";
import { paymentMode } from "@/lib/env";
import { siteUrl } from "@/lib/site";
import { guestSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/modules/securite/rate-limit";
import { startBookingPayment, startMembershipPayment } from "@/lib/modules/paiements/service"; // --- Vague 2 · paiements ---
import { claimReferral } from "@/lib/modules/engagement/referral"; // --- Lot 4 ---

const bodySchema = z.object({
  kind: z.enum(["ticket", "join", "renew", "upgrade"]),
  eventId: z.string().max(64).optional(),
  plan: z.enum(["member", "premium"]).optional(),
  // --- Vague 2 · paiements --- : adhésion en 1, 3 ou 12 fois
  installments: z.number().int().min(1).max(12).optional(),
  firstName: z.string().max(80).optional(),
  whatsapp: z.string().max(40).optional(),
  referralCode: z.string().max(20).optional(),
});

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Paiement en ligne (page hébergée du prestataire, Stripe aujourd'hui) d'une réservation ou d'une adhésion.
 * Passe par le point d'entrée unique du module paiements ; la confirmation arrive par le webhook.
 * La place est retenue (« pending ») pendant 30 minutes.
 */
export async function POST(req: NextRequest) {
  if (paymentMode() !== "stripe") return fail("Le paiement en ligne n’est pas activé.", 404);
  const limit = await rateLimit("checkout"); // --- Lot 6 ---
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Demande invalide.");
  const input = parsed.data;
  const viewer = await getViewer();
  const repo = getRepo();
  const base = await siteUrl();

  if (input.kind === "ticket") {
    const ev = input.eventId ? await repo.getEventById(input.eventId) : null;
    if (!ev || ev.status !== "published" || ymdOf(ev.startsAt) < today()) return fail("Ce rendez-vous n’est plus ouvert aux réservations.");
    let profileId = viewer.profile?.id ?? null;
    let guestFirstName: string | null = null;
    let guestWhatsapp: string | null = null;
    if (!viewer.profile) {
      const g = guestSchema.safeParse({ firstName: input.firstName ?? "", whatsapp: input.whatsapp ?? "" });
      if (!g.success) return fail(g.error.issues[0].message);
      if (viewer.mode === "demo") {
        profileId = (await repo.createGuestProfile({ firstName: g.data.firstName, lastName: "", whatsapp: g.data.whatsapp, email: null })).id;
      } else {
        guestFirstName = g.data.firstName;
        guestWhatsapp = g.data.whatsapp;
      }
    }
    const amount = priceFor(ev, viewer.profile?.plan ?? "free");
    if (amount === null) return fail("Ce rendez-vous est réservé aux Premium.");
    if (amount === 0) return fail("Cette place est offerte : pas de paiement.");
    const r = await repo.bookEvent({
      eventId: ev.id,
      profileId,
      guestFirstName,
      guestWhatsapp,
      amount,
      method: "card",
      initialStatus: "pending",
      declareTransfer: false,
      waitlistIfFull: false,
    });
    if (r.status === "full") return fail("C’est complet. Inscris-toi sur la liste d’attente.");
    if (r.status === "already" && r.booking.status !== "pending") return fail("Tu as déjà ta place pour ce rendez-vous.");
    const pay = await startBookingPayment({ bookingId: r.booking.id, ticketCode: r.booking.ticketCode, eventTitle: ev.title, eventSlug: ev.slug, amount, profile: viewer.profile, base });
    if (!pay.ok) return fail(pay.error, 502);
    if (!viewer.profile) {
      const jar = await cookies();
      const list = (jar.get(TICKETS_COOKIE)?.value ?? "").split(",").filter(Boolean);
      if (!list.includes(r.booking.ticketCode)) list.push(r.booking.ticketCode);
      jar.set(TICKETS_COOKIE, list.slice(-20).join(","), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    }
    return NextResponse.json(pay.type === "redirect" ? { url: pay.url } : { done: true });
  }

  // adhésion, renouvellement, passage Premium (compte obligatoire : le paiement en ligne est rattaché à un e-mail)
  let profile = viewer.profile;
  if (!profile) {
    if (viewer.mode === "real" || input.kind !== "join") return fail("Connecte-toi d’abord avec ton e-mail.", 401);
    const g = guestSchema.safeParse({ firstName: input.firstName ?? "", whatsapp: input.whatsapp ?? "" });
    if (!g.success) return fail(g.error.issues[0].message);
    profile = await repo.createGuestProfile({ firstName: g.data.firstName, lastName: "", whatsapp: g.data.whatsapp, email: null });
  }
  if (input.kind === "join") await claimReferral(profile.id, input.referralCode); // --- Lot 4 ---
  if (input.kind === "upgrade" && profile.plan === "premium") return fail("Tu es déjà Premium.");
  // --- Lancement --- adhésion sur validation : une candidature acceptée est demandée avant la première adhésion
  if (input.kind === "join") {
    const gate = await (await import("@/lib/modules/lancement/server")).membershipGate(viewer.profile);
    if (gate) return fail(gate, 403);
  }
  const plan = input.kind === "upgrade" ? "premium" : input.kind === "renew" ? (profile.plan === "premium" ? "premium" : "member") : (input.plan ?? "member");
  const pay = await startMembershipPayment({
    profile,
    action: input.kind,
    plan,
    amount: membershipAmount(input.kind, plan),
    installments: input.installments ?? 1,
    base,
    successUrl: input.kind === "join" ? `${base}/connexion?adhesion=merci` : `${base}/mes-paiements?paiement=ok`,
    cancelUrl: input.kind === "join" ? `${base}/formules` : `${base}/espace/moi`,
  });
  if (!pay.ok) return fail(pay.error, 400);
  return NextResponse.json(pay.type === "redirect" ? { url: pay.url } : { done: true });
}
