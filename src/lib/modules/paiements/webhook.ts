/**
 * Webhook unique des prestataires : vérifie la signature, stocke l'événement (payment_events), le traite
 * une seule fois (processor.ingestEvent), répond 200. En cas d'erreur de traitement : 500, le prestataire
 * réessaie plus tard (Stripe : pendant 3 jours) et une administratrice peut rejouer l'événement.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ingestEvent } from "./processor";
import { getProvider } from "./providers";
import { processorDeps } from "./service";
import type { ProviderId } from "./types";

export async function handleProviderWebhook(providerId: ProviderId, req: Request): Promise<NextResponse> {
  let provider;
  try {
    provider = getProvider(providerId);
  } catch {
    return NextResponse.json({ error: "Prestataire inconnu." }, { status: 404 });
  }
  if (!provider.verifyWebhook) return NextResponse.json({ error: "Ce prestataire n’envoie pas de webhook." }, { status: 404 });
  const raw = await req.text();
  let verified;
  try {
    verified = provider.verifyWebhook(raw, req.headers);
  } catch (e) {
    console.warn("[paiements] webhook refusé", providerId, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }
  try {
    const result = await ingestEvent(processorDeps(provider), { provider: providerId, ...verified });
    if (result === "processed") revalidatePath("/", "layout");
    return NextResponse.json({ received: true, result });
  } catch (e) {
    console.error("[paiements] traitement en échec", verified.type, verified.eventId, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Traitement en échec, réessayez." }, { status: 500 });
  }
}
