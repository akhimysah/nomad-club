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
    if (!error) return NextResponse.redirect(new URL(dest, url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", url));
}
