import { NextResponse, type NextRequest } from "next/server";
import { PERSONA_OF_SPACE, spaceOfPath } from "@/lib/permissions";
import { withReferralCookie } from "@/lib/modules/engagement/referral-cookie"; // --- Lot 4 ---
import { updateSession } from "@/lib/supabase/middleware";

const ROLE_COOKIE = "nc_demo_role";

/**
 * Garde d'accès.
 * - Mode démo : l'espace affiché dépend de l'adresse (/espace = Inès, /partenaire = Kenza, /pro = Loubna,
 *   /fondatrices = Julia et Nora, le reste = visiteuse). Le personnage est recopié dans le cookie nc_demo_role
 *   pour les pages et les actions.
 * - Mode réel : rafraîchit la session Supabase et vérifie la capacité exigée par l'espace
 *   (src/lib/permissions.ts) à partir des rôles de la personne.
 */
export async function middleware(request: NextRequest) {
  // --- Lot 4 --- : ?parrain=CODE est mémorisé dans un cookie pour l'inscription
  return withReferralCookie(request, await accessGuard(request));
}

async function accessGuard(request: NextRequest) {
  const real =Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (real) return updateSession(request);

  const persona = PERSONA_OF_SPACE[spaceOfPath(request.nextUrl.pathname)];
  if (request.cookies.get(ROLE_COOKIE)?.value === persona) return NextResponse.next();
  request.cookies.set(ROLE_COOKIE, persona);
  const response = NextResponse.next({ request });
  response.cookies.set(ROLE_COOKIE, persona, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|img/|icons/|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|api/stripe/webhook).*)"],
};
