"use server";

import { cookies } from "next/headers";
import { ROLE_COOKIE } from "@/lib/auth";
import { isRealMode } from "@/lib/env";

export type Space = "visit" | "member" | "founders";

/** Sélecteur d'espace du mode démo : retient l'espace choisi dans un cookie. */
export async function switchSpace(space: Space): Promise<void> {
  if (isRealMode()) return;
  const role = space === "member" ? "member" : space === "founders" ? "founder" : "guest";
  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
}
