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

// --- Mot de passe --- connexion classique, en plus du lien magique

const passwordSchema = z.string().min(8, "Au moins 8 caractères, s’il te plaît.").max(72, "72 caractères au maximum.");

/** Connexion par e-mail et mot de passe (mode réel). Redirige vers l'espace demandé. */
export async function signInWithPassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isRealMode()) return { ok: false, message: "En démo, pas besoin de te connecter : choisis un espace en haut de l’écran." };
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { ok: false, message: email.error.issues[0].message };
  const password = String(form.get("password") ?? "");
  if (!password) return { ok: false, message: "Entre ton mot de passe, ou reçois un lien de connexion." };
  const limited = (await rateLimitMessage("passwordIp")) ?? (await rateLimitMessage("passwordEmail", `email:${email.data}`));
  if (limited) return { ok: false, message: limited };
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error || !data.user) {
    return { ok: false, message: "E-mail ou mot de passe incorrect. Pas encore de mot de passe ? Reçois un lien, puis choisis-en un dans ton compte." };
  }
  const { afterSignIn } = await import("@/lib/modules/securite/sign-in");
  let next = await afterSignIn(supabase, safeNext(String(form.get("suite") ?? "")));
  if (!next.startsWith("/connexion/")) next = await (await import("@/lib/modules/lancement/server")).afterMagicLink(supabase, data.user, next);
  redirect(next);
}

/** Mot de passe oublié : envoie un lien qui ouvre la page « Choisir mon mot de passe ». */
export async function sendPasswordReset(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isRealMode()) return { ok: false, message: "Pas de mot de passe en démo." };
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const limited = (await rateLimitMessage("magicLinkIp")) ?? (await rateLimitMessage("passwordReset", `email:${parsed.data}`));
  if (limited) return { ok: false, message: limited };
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const base = await siteUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${base}/auth/callback?suite=${encodeURIComponent("/compte/mot-de-passe")}` });
  // Même réponse que l'adresse existe ou non : on ne révèle pas qui a un compte.
  return { ok: true, message: `Si un compte existe pour ${parsed.data}, un lien vient de partir pour choisir un nouveau mot de passe.` };
}

/** Choisir ou changer son mot de passe (personne connectée). */
export async function updatePassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isRealMode()) return { ok: false, message: "Pas de mot de passe en démo." };
  const pwd = passwordSchema.safeParse(String(form.get("password") ?? ""));
  if (!pwd.success) return { ok: false, message: pwd.error.issues[0].message };
  if (pwd.data !== String(form.get("confirm") ?? "")) return { ok: false, message: "Les deux mots de passe ne sont pas identiques." };
  const limited = await rateLimitMessage("account");
  if (limited) return { ok: false, message: limited };
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, message: "Ta session a expiré : reconnecte-toi, puis recommence." };
  const { error } = await supabase.auth.updateUser({ password: pwd.data });
  if (error) {
    if (/same|different/i.test(error.message)) return { ok: false, message: "C’est déjà ton mot de passe actuel : choisis-en un autre." };
    if (/weak|pwned|strength/i.test(error.message)) return { ok: false, message: "Ce mot de passe est trop simple ou trop connu. Choisis-en un plus original." };
    if (/reauth/i.test(error.message)) return { ok: false, message: "Pour changer ton mot de passe, reconnecte-toi d’abord avec un lien reçu par e-mail." };
    return { ok: false, message: "Le mot de passe n’a pas pu être enregistré. Réessaie dans un instant." };
  }
  return { ok: true, message: "C’est enregistré : tu peux maintenant te connecter avec ton e-mail et ce mot de passe." };
}
