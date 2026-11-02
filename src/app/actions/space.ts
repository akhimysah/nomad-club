"use server";

import { cookies } from "next/headers";
import { ROLE_COOKIE } from "@/lib/auth";
import { isRealMode } from "@/lib/env";
import { PERSONA_OF_SPACE, SPACE_ORDER, type Space } from "@/lib/permissions";

/** Sélecteur d'espace du mode démo : retient le personnage choisi dans un cookie. */
export async function switchSpace(space: Space): Promise<void> {
  if (isRealMode() || !SPACE_ORDER.includes(space)) return;
  const jar = await cookies();
  jar.set(ROLE_COOKIE, PERSONA_OF_SPACE[space], { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
}
