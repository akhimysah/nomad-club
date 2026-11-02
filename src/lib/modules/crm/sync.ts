/**
 * Synchronisation profils → contacts : chaque compte de l'appli a sa fiche contact, sans doublon.
 * En mode réel, c'est le déclencheur crm_sync_profile (0007_crm.sql) ; en démo, cette fonction.
 * Aucune dépendance d'exécution (importé aussi par seed.ts et le script seed:sql).
 */
import type { Profile } from "../../types.ts";
import type { Contact } from "./types.ts";

/** Identifiant de la fiche d'un profil en démo (stable). */
export const profileContactId = (profileId: string) => `crm-${profileId}`;

export function profileContact(p: Profile): Contact {
  return {
    id: profileContactId(p.id),
    kind: "person",
    profileId: p.id,
    organizationId: null,
    firstName: p.firstName,
    lastName: p.lastName,
    company: null,
    job: p.job,
    email: p.email,
    phone: p.whatsapp,
    instagram: null,
    city: null,
    source: "appli",
    status: "prospect",
    tags: [],
    notes: "",
    marketingConsent: false,
    consentAt: null,
    ownerId: null,
    createdBy: null,
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  };
}

/** Fiches à créer pour les profils qui n'en ont pas encore. */
export function missingProfileContacts(contacts: Contact[], profiles: Profile[]): Contact[] {
  const linked = new Set(contacts.map((c) => c.profileId).filter(Boolean));
  const ids = new Set(contacts.map((c) => c.id));
  return profiles
    .filter((p) => !linked.has(p.id))
    .map((p) => {
      const c = profileContact(p);
      // une ancienne fiche fusionnée a pu garder cet identifiant
      return ids.has(c.id) ? { ...c, id: `${c.id}-${Date.parse(p.createdAt) || 0}` } : c;
    });
}
