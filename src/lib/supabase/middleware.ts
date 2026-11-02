import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminMfaRequired, MFA_PATH } from "../modules/securite/mfa-core"; // --- Lot 6 ---
import { isGrantableRole, requiredCapability, rolesCan } from "../permissions";
import type { Role } from "../types";

/**
 * Rafraîchit la session Supabase (cookies) et protège les espaces privés.
 * Chaque espace exige une capacité (src/lib/permissions.ts), calculée à partir des rôles (table user_roles).
 * La vérification est refaite côté serveur dans chaque layout (requireCapability).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const cap = requiredCapability(path);
  if (!cap) return response;

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suite=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  };
  if (!user) return toLogin();

  const { data: rows } = await supabase.from("user_roles").select("role").eq("profile_id", user.id);
  const roles: Role[] = (rows ?? []).map((r) => r.role as unknown).filter(isGrantableRole);
  // --- Lot 6 --- espace admin : double authentification (session AAL2) exigée en mode réel
  if (cap === "space.admin" && roles.includes("admin") && adminMfaRequired()) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = MFA_PATH;
      url.search = `?suite=${encodeURIComponent(path)}`;
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // garde la session rafraîchie
      return redirect;
    }
  }
  if (rolesCan(roles, cap)) return response;
  if (cap === "space.member") {
    const url = request.nextUrl.clone();
    url.pathname = "/formules";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return toLogin();
}
