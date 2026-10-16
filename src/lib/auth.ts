import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRepo } from "./data";
import { isTicketCode } from "./domain/tickets";
import { isRealMode } from "./env";
import { DEMO_FOUNDER_ID, DEMO_MEMBER_ID } from "./seed";
import type { Role, Viewer } from "./types";

/** Cookie du sélecteur d'espace (mode démo uniquement). */
export const ROLE_COOKIE = "nc_demo_role";
/** Billets réservés sans compte, pour retrouver « Ta place est réservée ». */
export const TICKETS_COOKIE = "nc_billets";

export function parseRole(v: string | undefined): Role {
  return v === "member" || v === "founder" ? v : "guest";
}

export const getViewer = cache(async (): Promise<Viewer> => {
  const jar = await cookies();
  const guestTickets = (jar.get(TICKETS_COOKIE)?.value ?? "").split(",").filter(isTicketCode);
  if (!isRealMode()) {
    const role = parseRole(jar.get(ROLE_COOKIE)?.value);
    const repo = getRepo();
    const profile = role === "member" ? await repo.getProfile(DEMO_MEMBER_ID) : role === "founder" ? await repo.getProfile(DEMO_FOUNDER_ID) : null;
    return { role, profile, guestTickets, mode: "demo" };
  }
  const { getSessionProfile } = await import("./supabase/session");
  const profile = await getSessionProfile();
  return { role: profile?.role ?? "guest", profile, guestTickets, mode: "real" };
});

/** Espace membre : adhérente ou fondatrice. */
export async function requireMember(next = "/espace") {
  const v = await getViewer();
  if (!v.profile || (v.role !== "member" && v.role !== "founder")) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return { ...v, profile: v.profile };
}

export async function requireFounder(next = "/fondatrices") {
  const v = await getViewer();
  if (!v.profile || v.role !== "founder") redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return { ...v, profile: v.profile };
}
