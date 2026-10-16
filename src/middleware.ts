import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ROLE_COOKIE = "nc_demo_role";

function demoRoleFor(pathname: string): "guest" | "member" | "founder" {
  if (pathname.startsWith("/espace")) return "member";
  if (pathname.startsWith("/fondatrices")) return "founder";
  return "guest";
}

/**
 * Garde d'accès.
 * - Mode démo : l'espace affiché dépend de l'adresse (/espace = Inès, /fondatrices = Julia et Nora,
 *   le reste = visiteuse). Le rôle est recopié dans le cookie nc_demo_role pour les pages et les actions.
 * - Mode réel : rafraîchit la session Supabase et réserve /espace aux adhérentes, /fondatrices aux fondatrices.
 */
export async function middleware(request: NextRequest) {
  const real = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (real) return updateSession(request);

  const role = demoRoleFor(request.nextUrl.pathname);
  if (request.cookies.get(ROLE_COOKIE)?.value === role) return NextResponse.next();
  request.cookies.set(ROLE_COOKIE, role);
  const response = NextResponse.next({ request });
  response.cookies.set(ROLE_COOKIE, role, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|img/|icons/|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|api/stripe/webhook).*)"],
};
