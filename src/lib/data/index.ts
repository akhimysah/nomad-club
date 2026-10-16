import { isRealMode } from "../env";
import { demoRepo } from "./demo-repo";
import type { Repo } from "./repo";

/** Choisit l'implémentation selon les variables d'environnement. */
export function getRepo(): Repo {
  if (isRealMode()) throw new Error("Mode réel : supabase-repo pas encore branché.");
  return demoRepo;
}
