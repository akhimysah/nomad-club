import { NextResponse, type NextRequest } from "next/server";
import { isRealMode } from "@/lib/env";

/** Retour du lien magique : échange le code contre une session puis redirige. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("suite");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/espace";
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
      return NextResponse.redirect(new URL(dest, url));
    }
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", url));
}
