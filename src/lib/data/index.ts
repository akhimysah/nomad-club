import { isRealMode } from "../env";
import { demoRepo } from "./demo-repo";
import type { Repo } from "./repo";
import { supabaseRepo } from "./supabase-repo";

/** Choisit l'implémentation selon les variables d'environnement (démo en mémoire ou Supabase). */
export function getRepo(): Repo {
  return isRealMode() ? supabaseRepo : demoRepo;
}
