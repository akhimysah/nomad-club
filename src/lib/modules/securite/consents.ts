/** Lot 6 — libellés et règles des consentements (module pur, importable côté client). */
import { CONSENT_KINDS, type ConsentKind, type ConsentRecord, type ConsentState } from "./types";

/** Délai de grâce avant le traitement d'une demande de suppression (aligné sur 0008_securite.sql). */
export const GRACE_DAYS = 30;

export const CONSENT_LABEL: Record<ConsentKind, { label: string; hint: string }> = {
  geolocation: {
    label: "Ma position sur la carte",
    hint: "Ton quartier (jamais ta position exacte) apparaît sur la carte des membres. Retirable à tout moment.",
  },
  communications: {
    label: "Nouvelles du club",
    hint: "E-mails et messages WhatsApp sur les rendez-vous et la vie du club. Les messages liés à ton adhésion partent toujours.",
  },
  directory: {
    label: "Ma fiche dans l’annuaire",
    hint: "Les autres membres voient ton prénom, ton métier et ton pays dans l’annuaire du cercle.",
  },
  image: {
    label: "Droit à l’image",
    hint: "Les photos des rendez-vous où tu apparais peuvent être publiées dans l’appli et sur les réseaux du club.",
  },
};

/** Valeur quand la personne n'a encore rien choisi (même règle que consent_default() en SQL). */
export function consentDefault(kind: ConsentKind): boolean {
  return kind === "directory";
}

export function isConsentKind(v: unknown): v is ConsentKind {
  return typeof v === "string" && (CONSENT_KINDS as readonly string[]).includes(v);
}

/** État courant de chaque consentement à partir de l'historique. */
export function consentStates(history: ConsentRecord[]): ConsentState[] {
  return CONSENT_KINDS.map((kind) => {
    const last = history.filter((c) => c.kind === kind).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return last ? { kind, granted: last.granted, at: last.createdAt, isDefault: false } : { kind, granted: consentDefault(kind), at: null, isDefault: true };
  });
}
