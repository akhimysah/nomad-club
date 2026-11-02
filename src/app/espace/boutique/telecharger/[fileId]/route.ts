import { serveProductFile } from "@/lib/modules/engagement/download";

export const dynamic = "force-dynamic";

/** Téléchargement sécurisé d'une ressource achetée (ou d'un aperçu gratuit). */
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  return serveProductFile((await params).fileId);
}
