import { personalExportResponse } from "@/lib/modules/securite/export-route";

export const dynamic = "force-dynamic";

/** Lot 6 — « Télécharger mes données » (JSON) depuis l'espace membre. */
export async function GET() {
  return personalExportResponse();
}
