"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { isRealMode } from "@/lib/env";
import { normalizeReferralCode, REFERRAL_COOKIE } from "@/lib/modules/engagement/referral-cookie"; // --- Lot 4 ---
import { rateLimitMessage } from "@/lib/modules/securite/rate-limit";
import { safeRedirectPath } from "@/lib/modules/securite/request";
import { siteUrl } from "@/lib/site";

export type LoginState = { ok: boolean; message: string } | null;

const emailSchema = z.string().trim().toLowerCase().max(254, "Une adresse e-mail valide, s’il te plaît.").email("Une adresse e-mail valide, s’il te plaît.");

// --- Lot 6 --- redirection interne sûre (refuse aussi « /\domaine ») et limitation de fréquence
const safeNext = (next: string | null | undefined) => safeRedirectPath(next, "/espace");

/** Envoie le lien magique de connexion (mode réel). */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isRealMode()) return { ok: false, message: "En démo, pas besoin de te connecter : choisis un espace en haut de l’écran." };
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const limited = (await rateLimitMessage("magicLinkIp")) ?? (await rateLimitMessage("magicLinkEmail", `email:${parsed.data}`));
  if (limited) return { ok: false, message: limited };
  const next = safeNext(String(form.get("suite") ?? ""));
  // --- Lot 4 --- : code de parrainage saisi, rattaché au compte au retour du lien magique
  const parrain = normalizeReferralCode(form.get("parrain"));
  if (parrain) (await cookies()).set(REFERRAL_COOKIE, parrain, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const base = await siteUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${base}/auth/callback?suite=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { ok: false, message: "L’envoi n’a pas fonctionné. Réessaie dans une minute." };
  return { ok: true, message: `C’est parti : un lien de connexion vient d’être envoyé à ${parsed.data}. Ouvre-le sur cet appareil.` };
}

export async function signOut(): Promise<void> {
  if (isRealMode()) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/?au-revoir=1"); // --- Lot 6 --- le service worker vide le cache des pages
}
