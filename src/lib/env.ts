import type { PaymentMode } from "./types";

/**
 * Le mode est choisi par les variables d'environnement :
 * - mode réel si NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont définies ;
 * - sinon mode démo (données en mémoire, sélecteur d'espace).
 */
export function isRealMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// --- Lancement --- mode démo interdit explicitement (production) ---
/**
 * NEXT_PUBLIC_DEMO=false interdit le mode démo : sans Supabase, l'appli n'affiche ni sélecteur d'espace
 * ni données d'exemple, mais la page « configuration manquante ». Par défaut (variable absente), la démo
 * reste permise pour ne rien changer en développement.
 */
export function demoAllowed(): boolean {
  return process.env.NEXT_PUBLIC_DEMO !== "false";
}

/** Ni Supabase configuré, ni démo permise : rien ne doit s'afficher hormis la page d'explication. */
export function configMissing(): boolean {
  return !isRealMode() && !demoAllowed();
}

/** Page de maintenance (MAINTENANCE_MODE=true). */
export function maintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}

export function appMode(): "demo" | "real" {
  return isRealMode() ? "real" : "demo";
}

/** Stripe si une clé secrète est présente, sinon paiement simulé (démo) ou virement déclaré (réel). */
export function paymentMode(): PaymentMode {
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return isRealMode() ? "transfer" : "demo";
}

/** Coordonnées bancaires affichées pour un virement (mode réel sans Stripe). */
export function transferDetails(): { holder: string; iban: string } {
  return {
    holder: process.env.NEXT_PUBLIC_TRANSFER_HOLDER || "Nomad Club",
    iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "communiqué par Julia et Nora sur WhatsApp",
  };
}
