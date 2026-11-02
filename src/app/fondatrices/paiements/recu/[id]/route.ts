import { serveReceipt } from "@/lib/modules/paiements/receipt";

export const dynamic = "force-dynamic";

/** Reçu d'un encaissement (fondatrices : tous les reçus). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return serveReceipt((await params).id);
}
