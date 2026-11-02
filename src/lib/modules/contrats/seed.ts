/**
 * Vague 2 · Contrats — données d'exemple : contrats acceptés (membres, partenaires, pro) et un contrat en attente.
 * Les identités (noms, e-mails, établissements) viennent du jeu de démo principal (src/lib/seed.ts) ;
 * le texte, le PDF et l'empreinte sont calculés au chargement (demo-repo.ts et scripts/seed-sql/contrats.mjs).
 * Ce fichier n'importe que des types et des données (lu aussi par les scripts Node).
 */
import type { ContractKind } from "./types.ts";

export type SeedContract = {
  id: string;
  number: string;
  kind: ContractKind;
  profileId: string;
  organizationId: string | null;
  plan: string;
  amount: number;
  installments: number;
  startsOn: string;
  endsOn: string | null;
  /** ISO : date de génération (aussi celle des métadonnées du PDF). */
  createdAt: string;
  subscriptionRef: string | null;
  acceptance: { at: string; ip: string; userAgent: string } | null;
  remindedAt?: string | null;
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

export const CONTRATS_SEED: readonly SeedContract[] = [
  {
    id: "ct-ines-2025",
    number: "NC-ADH-2025-K7Q2MA",
    kind: "membership",
    profileId: "p-ines",
    organizationId: null,
    plan: "member",
    amount: 670,
    installments: 3,
    startsOn: "2025-11-18",
    endsOn: "2026-11-18",
    createdAt: "2025-11-18T09:41:00.000Z",
    subscriptionRef: "pay-ines-2025",
    acceptance: { at: "2025-11-18T09:43:12.000Z", ip: "105.158.24.17", userAgent: IPHONE },
  },
  {
    id: "ct-yasmine-2025",
    number: "NC-ADH-2025-P3W8ZT",
    kind: "membership",
    profileId: "p-yasmine",
    organizationId: null,
    plan: "premium",
    amount: 1250,
    installments: 1,
    startsOn: "2025-11-02",
    endsOn: "2026-11-02",
    createdAt: "2025-11-02T17:05:00.000Z",
    subscriptionRef: "pay-yasmine-2025",
    acceptance: { at: "2025-11-02T17:06:40.000Z", ip: "196.75.110.42", userAgent: MAC },
  },
  {
    id: "ct-lou-2026",
    number: "NC-ADH-2026-L4V9RC",
    kind: "membership",
    profileId: "p-lou",
    organizationId: null,
    plan: "member",
    amount: 670,
    installments: 1,
    startsOn: "2026-10-11",
    endsOn: "2027-10-11",
    createdAt: "2026-10-11T08:20:00.000Z",
    subscriptionRef: null,
    acceptance: null,
    remindedAt: null,
  },
  {
    id: "ct-bloom-2026",
    number: "NC-PAR-2026-B9H3NE",
    kind: "partner",
    profileId: "p-g11",
    organizationId: "org-bloom",
    plan: "partenaire",
    amount: 0,
    installments: 1,
    startsOn: "2026-02-03",
    endsOn: "2027-02-03",
    createdAt: "2026-02-03T11:25:00.000Z",
    subscriptionRef: null,
    acceptance: { at: "2026-02-03T11:31:05.000Z", ip: "41.250.36.8", userAgent: ANDROID },
  },
  {
    id: "ct-amaj-2026",
    number: "NC-PAR-2026-M2J7DX",
    kind: "partner",
    profileId: "p-rim",
    organizationId: "org-amaj",
    plan: "partenaire",
    amount: 0,
    installments: 1,
    startsOn: "2026-05-20",
    endsOn: "2027-05-20",
    createdAt: "2026-05-20T15:02:00.000Z",
    subscriptionRef: null,
    acceptance: { at: "2026-05-20T15:10:44.000Z", ip: "105.66.140.201", userAgent: IPHONE },
  },
  {
    id: "ct-cherkaoui-2026",
    number: "NC-PRO-2026-C5T8GU",
    kind: "pro",
    profileId: "p-g34",
    organizationId: "org-cherkaoui",
    plan: "visibilite",
    amount: 49,
    installments: 1,
    startsOn: "2026-09-01",
    endsOn: null,
    createdAt: "2026-09-01T09:35:00.000Z",
    subscriptionRef: "sp-org-cherkaoui-1",
    acceptance: { at: "2026-09-01T09:38:21.000Z", ip: "196.92.7.150", userAgent: MAC },
  },
];
