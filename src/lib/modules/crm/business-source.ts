/**
 * Source des retombées commerciales (deals déclarés par les membres, Espace Business du Lot 4).
 *
 * Le CRM ne dépend pas du code du Lot 4 : il lit une source enregistrée ici. Tant qu'aucune source
 * n'est branchée, il affiche des exemples en démo et un emplacement vide en mode réel.
 * Pour brancher le module Business (une fois fusionné), depuis son propre code serveur :
 *
 *   import { registerDealOutcomeSource } from "@/lib/modules/crm/business-source";
 *   registerDealOutcomeSource(async () => (await getRepo().listConfirmedDeals()).map((d) => ({ id: d.id, month: d.confirmedAt.slice(0, 7), amount: d.amount, sector: d.sector, profileIds: [d.sellerId, d.buyerId] })));
 */
import { isRealMode } from "../../env";
import type { DealOutcome, DealOutcomeSource } from "./types";

type Loader = () => Promise<DealOutcome[]>;

type G = typeof globalThis & { __nomadCrmDealSource?: Loader };

export function registerDealOutcomeSource(loader: Loader): void {
  (globalThis as G).__nomadCrmDealSource = loader;
}

/** Exemples (mode démo) : montants plausibles sur les derniers mois. */
function samples(today: string): DealOutcome[] {
  const [y, m] = today.split("-").map(Number);
  const ym = (back: number) => {
    const t = y * 12 + (m - 1) - back;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  };
  const rows: Array<[number, number, string, string[]]> = [
    [9, 1200, "Décoration et architecture", ["p-salma", "p-capucine"]],
    [8, 650, "Communication", ["p-ines", "p-g05"]],
    [7, 2400, "Hôtellerie", ["p-anais", "p-g12"]],
    [6, 900, "Bien-être", ["p-leila", "p-g11"]],
    [5, 1800, "Conseil", ["p-sophie", "p-g04"]],
    [4, 450, "Photographie", ["p-chloe", "p-g15"]],
    [3, 3200, "Hôtellerie", ["p-anais", "p-g20"]],
    [2, 750, "Communication", ["p-ines", "p-nawal"]],
    [2, 1100, "Juridique", ["p-yasmine", "p-g02"]],
    [1, 1500, "Décoration et architecture", ["p-salma", "p-g30"]],
    [0, 600, "Bien-être", ["p-g11", "p-justine"]],
  ];
  return rows.map(([back, amount, sector, profileIds], i) => ({ id: `deal-ex-${i + 1}`, month: ym(back), amount, sector, profileIds }));
}

export async function loadDealOutcomes(today: string): Promise<DealOutcomeSource> {
  const loader = (globalThis as G).__nomadCrmDealSource;
  if (loader) {
    try {
      return { available: true, sample: false, rows: await loader() };
    } catch (e) {
      console.error("[crm] retombées des deals indisponibles :", e instanceof Error ? e.message : e);
      return { available: false, sample: false, rows: [] };
    }
  }
  if (isRealMode()) return { available: false, sample: false, rows: [] };
  return { available: true, sample: true, rows: samples(today) };
}
