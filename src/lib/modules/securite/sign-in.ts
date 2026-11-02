/**
 * Lot 6 — après la connexion par lien magique (mode réel) :
 * journalise la connexion d'une administratrice et l'envoie vers la double authentification si elle est exigée.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ipFromHeaders } from "./request";
import { adminMfaRequired, MFA_PATH } from "./mfa-core";
import { headers } from "next/headers";

export async function afterSignIn(supabase: SupabaseClient, dest: string): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return dest;
    const { data: rows } = await supabase.from("user_roles").select("role").eq("profile_id", user.id);
    const admin = (rows ?? []).some((r) => r.role === "admin");
    if (!admin) return dest;
    const h = await headers();
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "auth.admin_login",
      target_type: "profile",
      target_id: user.id,
      summary: "Connexion d’une administratrice (lien magique)",
      details: { ip: ipFromHeaders(h), userAgent: (h.get("user-agent") ?? "").slice(0, 200) },
    });
    if (adminMfaRequired() && dest.startsWith("/fondatrices")) return `${MFA_PATH}?suite=${encodeURIComponent(dest)}`;
    return dest;
  } catch (e) {
    console.error("[securite] après connexion :", e instanceof Error ? e.message : e);
    return dest;
  }
}
