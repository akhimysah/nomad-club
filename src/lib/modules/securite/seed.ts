/** Lot 6 — données d'exemple du module (mode démo uniquement : pas de seed SQL nécessaire). */
import type { ConsentRecord, DeletionRequest, SecuritySettings, StoredPushSubscription } from "./types";

export type SecuriteSeed = {
  consents: ConsentRecord[];
  deletions: DeletionRequest[];
  push: StoredPushSubscription[];
  settings: SecuritySettings;
};

const at = (ymd: string, hm = "10:00") => new Date(`${ymd}T${hm}:00+01:00`).toISOString();

export function createSecuriteSeed(): SecuriteSeed {
  return {
    consents: [
      { id: "cs-1", profileId: "p-ines", kind: "directory", granted: true, source: "adhesion", createdAt: at("2025-03-02", "18:20") },
      { id: "cs-2", profileId: "p-ines", kind: "communications", granted: true, source: "adhesion", createdAt: at("2025-03-02", "18:20") },
      { id: "cs-3", profileId: "p-ines", kind: "image", granted: false, source: "app", createdAt: at("2026-05-11", "09:41") },
      { id: "cs-4", profileId: "p-ines", kind: "image", granted: true, source: "app", createdAt: at("2026-09-28", "21:03") },
    ],
    deletions: [
      {
        id: "del-chloe",
        profileId: "p-chloe",
        reason: "Je quitte le Maroc à la fin de l’année.",
        status: "pending",
        requestedAt: at("2026-09-10", "08:30"),
        scheduledFor: at("2026-10-10", "08:30"),
        processedAt: null,
        processedBy: null,
        adminNote: null,
      },
    ],
    push: [],
    settings: { adminMfaEnforced: false },
  };
}
