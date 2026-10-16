import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase (cookies) et protège les espaces privés.
 * La vérification est refaite côté serveur dans chaque layout (requireMember / requireFounder).
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
  const needsMember = path.startsWith("/espace");
  const needsFounder = path.startsWith("/fondatrices");
  if (!needsMember && !needsFounder) return response;

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suite=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  };
  if (!user) return toLogin();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role as string | undefined) ?? "guest";
  if (needsFounder && role !== "founder") return toLogin();
  if (needsMember && role !== "member" && role !== "founder") {
    const url = request.nextUrl.clone();
    url.pathname = "/formules";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
