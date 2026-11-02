import { personalExportResponse } from "@/lib/modules/securite/export-route";

export const dynamic = "force-dynamic";

/**
 * Lot 6 — export RGPD pour tout compte connecté (membre, compte gratuit, partenaire, pro) et futures applis natives.
 * Dans l'appli web, l'espace membre passe par /espace/moi/donnees/export.
 */
export async function GET() {
  return personalExportResponse();
}
