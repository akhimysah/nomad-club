import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer, TICKETS_COOKIE } from "@/lib/auth";
import { today, ymdOf } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { priceFor } from "@/lib/domain/events";
import { membershipAmount } from "@/lib/domain/membership";
import { paymentMode } from "@/lib/env";
import { fullName } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { guestSchema } from "@/lib/validation";

const bodySchema = z.object({
  kind: z.enum(["ticket", "join", "renew", "upgrade"]),
  eventId: z.string().optional(),
  plan: z.enum(["member", "premium"]).optional(),
  firstName: z.string().optional(),
  whatsapp: z.string().optional(),
});

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Crée une session Stripe Checkout (réservation payante ou adhésion) et renvoie son adresse.
 * La place est retenue (« pending ») pendant 30 minutes ; le webhook confirme le paiement.
 */
export async function POST(req: NextRequest) {
  if (paymentMode() !== "stripe") return fail("Le paiement en ligne n’est pas activé.", 404);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Demande invalide.");
  const input = parsed.data;
  const viewer = await getViewer();
  const repo = getRepo();
  const stripe = getStripe();
  const base = await siteUrl();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amount * 100, product_data: { name: `Nomad Club · ${ev.title}` } } }],
      metadata: { kind: "booking", id: r.booking.id },
      customer_email: viewer.profile?.email ?? undefined,
      success_url: `${base}/billet/${r.booking.ticketCode}?paye=1`,
      cancel_url: `${base}/rendez-vous/${ev.slug}`,
      expires_at: expiresAt,
      locale: "fr",
    });
    await repo.setBookingStripeSession(r.booking.id, session.id);
    if (!viewer.profile) {
      const jar = await cookies();
      const list = (jar.get(TICKETS_COOKIE)?.value ?? "").split(",").filter(Boolean);
      if (!list.includes(r.booking.ticketCode)) list.push(r.booking.ticketCode);
      jar.set(TICKETS_COOKIE, list.slice(-20).join(","), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    }
    return NextResponse.json({ url: session.url });
  }

  // adhésion, renouvellement, passage Premium
  let profile = viewer.profile;
  if (!profile) {
    if (viewer.mode === "real" || input.kind !== "join") return fail("Connecte-toi d’abord avec ton e-mail.", 401);
    const g = guestSchema.safeParse({ firstName: input.firstName ?? "", whatsapp: input.whatsapp ?? "" });
    if (!g.success) return fail(g.error.issues[0].message);
    profile = await repo.createGuestProfile({ firstName: g.data.firstName, lastName: "", whatsapp: g.data.whatsapp, email: null });
  }
  if (input.kind === "upgrade" && profile.plan === "premium") return fail("Tu es déjà Premium.");
  const plan = input.kind === "upgrade" ? "premium" : input.kind === "renew" ? (profile.plan === "premium" ? "premium" : "member") : (input.plan ?? "member");
  const amount = membershipAmount(input.kind, plan);
  const pay = await repo.recordMembership({ profileId: profile.id, payerName: fullName(profile), action: input.kind, plan, amount, method: "card", status: "declared" });
  const label = input.kind === "upgrade" ? "Passage à Premium" : `${input.kind === "renew" ? "Renouvellement" : "Adhésion"} ${plan === "premium" ? "Premium" : "Membre"} · 1 an`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amount * 100, product_data: { name: `Nomad Club · ${label}` } } }],
    metadata: { kind: "membership", id: pay.id },
    customer_email: profile.email ?? undefined,
    success_url: input.kind === "join" ? `${base}/connexion?adhesion=merci` : `${base}/espace/moi`,
    cancel_url: input.kind === "join" ? `${base}/formules` : `${base}/espace/moi`,
    expires_at: expiresAt,
    locale: "fr",
  });
  await repo.setPaymentStripeSession(pay.id, session.id);
  return NextResponse.json({ url: session.url });
}
