import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getRepo } from "@/lib/data";
import { getStripe } from "@/lib/stripe";

/**
 * Webhook Stripe : la signature est vérifiée avec STRIPE_WEBHOOK_SECRET.
 * - checkout.session.completed : la réservation ou l'adhésion est payée ;
 * - checkout.session.expired : la place retenue est libérée.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const repo = getRepo();
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    const kind = s.metadata?.kind;
    const id = s.metadata?.id;
    if ((kind === "booking" || kind === "membership") && id && s.payment_status === "paid") {
      await repo.markStripeSessionPaid(s.id, { kind, id });
      revalidatePath("/", "layout");
    }
  } else if (event.type === "checkout.session.expired") {
    const s = event.data.object;
    if (s.metadata?.kind === "booking" && s.metadata.id) {
      await repo.cancelBooking(s.metadata.id, null);
      revalidatePath("/", "layout");
    }
  }
  return NextResponse.json({ received: true });
}
