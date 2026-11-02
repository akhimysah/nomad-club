import type { NextRequest } from "next/server";
import { handleProviderWebhook } from "@/lib/modules/paiements/webhook";

export const dynamic = "force-dynamic";

/**
 * Webhook Stripe (adresse historique, à déclarer dans Stripe > Développeurs > Webhooks).
 * Vague 2 : délégué au traitement unique et idempotent du module paiements
 * (événements stockés dans payment_events, rejouables par une administratrice).
 */
export async function POST(req: NextRequest) {
  return handleProviderWebhook("stripe", req);
}
