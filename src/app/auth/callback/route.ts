import { NextResponse, type NextRequest } from "next/server";
import { isRealMode } from "@/lib/env";
import { safeRedirectPath } from "@/lib/modules/securite/request";

/** Retour du lien magique : échange le code contre une session puis redirige. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  // --- Lot 6 --- redirection interne sûre
  const dest = safeRedirectPath(url.searchParams.get("suite"), "/espace");
  if (!isRealMode()) return NextResponse.redirect(new URL("/", url));
  const code = url.searchParams.get("code");
  if (code) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // --- Lot 4 --- : rattache l'inscription à sa marraine (cookie nc_parrain)
      const { data } = await supabase.auth.getUser();
      if (data.user) await (await import("@/lib/modules/engagement/referral")).claimReferral(data.user.id);
      // --- E-mails --- bienvenue à la première connexion d'un compte tout juste créé (une seule fois)
      if (data.user) await (await import("@/lib/modules/emails/triggers")).sendWelcomeIfNew(data.user);
      // --- Lot 6 --- connexion journalisée pour les administratrices (puis double authentification)
      const { afterSignIn } = await import("@/lib/modules/securite/sign-in");
      let next = await afterSignIn(supabase, dest);
      // --- Lancement --- code de parrainage de l'inscription + onboarding à la première connexion
      if (data.user && !next.startsWith("/connexion/")) next = await (await import("@/lib/modules/lancement/server")).afterMagicLink(supabase, data.user, next);
      return NextResponse.redirect(new URL(next, url));
    }
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", url));
}
