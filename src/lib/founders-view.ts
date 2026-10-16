import { nowMs } from "./clock";
import { getRepo } from "./data";
import { computeDashboard } from "./domain/founders";

/** Tableau de bord des fondatrices, recalculé à chaque affichage depuis les données. */
export async function loadDashboard() {
  const now = nowMs();
  return { d: computeDashboard(await getRepo().snapshot(), now), now };
}
