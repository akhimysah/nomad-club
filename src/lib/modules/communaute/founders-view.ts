import { getRepo } from "../../data";

/** Compteurs des onglets Communauté (signalements ouverts, demandes de groupe). */
export async function communauteCounts() {
  const repo = getRepo();
  const [reports, requests] = await Promise.all([repo.countOpenReports(), repo.listGroupRequests()]);
  return {
    "/fondatrices/communaute/moderation": reports,
    "/fondatrices/communaute/groupes": requests.length,
  } as const;
}
