import { configMissing, isRealMode } from "../env";
import { demoRepo } from "./demo-repo";
import type { Repo } from "./repo";
import { supabaseRepo } from "./supabase-repo";

/** Choisit l'implémentation selon les variables d'environnement (démo en mémoire ou Supabase). */
export function getRepo(): Repo {
  // --- Lancement --- jamais de données d'exemple quand la démo est interdite (NEXT_PUBLIC_DEMO=false)
  if (configMissing()) throw new Error("Configuration manquante : Supabase n’est pas configuré et le mode démo est interdit (NEXT_PUBLIC_DEMO=false).");
  return isRealMode() ? supabaseRepo : demoRepo;
}
