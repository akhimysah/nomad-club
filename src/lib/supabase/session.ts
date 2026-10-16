import type { Profile } from "../types";

/** Profil de la personne connectée (mode réel). Branché à l'étape Supabase. */
export async function getSessionProfile(): Promise<Profile | null> {
  return null;
}
