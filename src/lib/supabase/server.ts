import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./config";

/** Client Supabase lié à la session de la personne (RLS appliquée). */
export async function supabaseServer() {
  const { url, anonKey } = supabaseEnv();
  const jar = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* appelé depuis un composant serveur : le middleware rafraîchit la session */
        }
      },
    },
  });
}

/**
 * Client « service » (contourne la RLS). Uniquement côté serveur, pour le webhook Stripe
 * et les opérations déjà vérifiées par l'application. Nécessite SUPABASE_SERVICE_ROLE_KEY.
 */
export function supabaseAdmin() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante (nécessaire pour le webhook Stripe).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
