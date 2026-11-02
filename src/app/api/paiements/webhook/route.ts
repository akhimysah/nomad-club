import type { NextRequest } from "next/server";
import { handleProviderWebhook } from "@/lib/modules/paiements/webhook";

export const dynamic = "force-dynamic";

/**
 * Vague 2 · paiements — webhook unique des prestataires de paiement.
 * Stripe (en-tête « stripe-signature ») ; un autre prestataire se désigne par ?provider=… (ex. cmi, plus tard).
 * Ancienne adresse conservée : /api/stripe/webhook (même traitement).
 */
export async function POST(req: NextRequest) {
  const provider = req.headers.get("stripe-signature") ? "stripe" : req.nextUrl.searchParams.get("provider");
  if (provider !== "stripe") return Response.json({ error: "Prestataire inconnu." }, { status: 404 });
  return handleProviderWebhook(provider, req);
}
