import type { Profile } from "../types";
import { supabaseServer } from "./server";

/** Profil de la personne connectée (mode réel), ou null. */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { supabaseRepo } = await import("../data/supabase-repo");
  return supabaseRepo.getProfile(user.id);
}
