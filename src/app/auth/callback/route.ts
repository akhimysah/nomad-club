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
      // --- Lot 6 --- connexion journalisée pour les administratrices (puis double authentification)
      const { afterSignIn } = await import("@/lib/modules/securite/sign-in");
      return NextResponse.redirect(new URL(await afterSignIn(supabase, dest), url));
    }
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", url));
}
