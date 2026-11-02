/** Barème de l'Espace Business (module pur, partagé par la démo, le seed et l'affichage). */
import type { EngagementSettings } from "./types";

/** Points reçus par chacune des deux membres pour un deal confirmé (même calcul que public.deal_points en SQL). */
export function dealPoints(s: Pick<EngagementSettings, "dealPointsBase" | "dealPointsPerThousand" | "dealPointsBonusCap">, amount: number | null): number {
  const bonus = Math.min(s.dealPointsBonusCap, Math.floor((amount ?? 0) / 1000) * s.dealPointsPerThousand);
  return s.dealPointsBase + Math.max(0, bonus);
}

export const DEFAULT_SETTINGS = {
  dealPointsBase: 10,
  dealPointsPerThousand: 2,
  dealPointsBonusCap: 40,
} as const;
