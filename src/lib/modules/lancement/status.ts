/**
 * Vague 2 — état du service pour /statut et /api/statut : mode, base de données (requête publique
 * minimale, avec la clé anon), services configurés. Aucune valeur secrète n'est exposée.
 */
import { configMissing, isRealMode, maintenanceMode, paymentMode } from "../../env";
import { monitoringEnabled } from "./monitoring";

export type ServiceStatus = {
  ok: boolean;
  mode: "réel" | "démo" | "configuration manquante";
  maintenance: boolean;
  database: { state: "ok" | "erreur" | "non utilisée"; ms: number | null };
  payments: string;
  emails: boolean;
  push: boolean;
  monitoring: boolean;
  version: string;
  checkedAt: string;
};

async function pingDatabase(): Promise<{ state: "ok" | "erreur"; ms: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const t0 = Date.now();
  try {
    // lancement_settings est lisible sans compte (0012) : une ligne, aucune donnée personnelle
    const res = await fetch(`${url}/rest/v1/lancement_settings?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    return { state: res.ok ? "ok" : "erreur", ms: Date.now() - t0 };
  } catch {
    return { state: "erreur", ms: Date.now() - t0 };
  }
}

export async function serviceStatus(): Promise<ServiceStatus> {
  const real = isRealMode();
  const database = real ? await pingDatabase() : { state: "non utilisée" as const, ms: null };
  const mode = real ? "réel" : configMissing() ? "configuration manquante" : "démo";
  const pm = paymentMode();
  return {
    ok: !maintenanceMode() && mode !== "configuration manquante" && database.state !== "erreur",
    mode,
    maintenance: maintenanceMode(),
    database,
    payments: pm === "stripe" ? (process.env.STRIPE_SECRET_KEY?.includes("_live_") ? "Stripe (réel)" : "Stripe (test)") : pm === "transfer" ? "Virement déclaré" : "Simulé (démo)",
    emails: Boolean(process.env.RESEND_API_KEY),
    push: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    monitoring: monitoringEnabled(),
    version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    checkedAt: new Date().toISOString(),
  };
}
