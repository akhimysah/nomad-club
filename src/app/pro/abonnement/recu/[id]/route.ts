import { serveReceipt } from "@/lib/modules/paiements/receipt";

export const dynamic = "force-dynamic";

/** Reçu d'un paiement de l'abonnement du carnet (facture Stripe si elle existe, sinon reçu PDF). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return serveReceipt((await params).id);
}
