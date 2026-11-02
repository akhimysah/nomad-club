"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { checkCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { roleGranted, roleRevoked } from "@/lib/notify";
import { isGrantableRole, ROLE_LABEL } from "@/lib/permissions";
import type { GrantableRole } from "@/lib/types";

export type RoleResult = { ok: true; message: string; roles: GrantableRole[] } | { ok: false; error: string };

/** Ajouter ou retirer un rôle à une personne (administratrices). Chaque changement est journalisé. */
export async function changeRoleAction(profileId: string, role: string, grant: boolean): Promise<RoleResult> {
  const me = await checkCapability("roles.manage");
  if (!me) return { ok: false, error: "Réservé aux administratrices." };
  if (!isGrantableRole(role)) return { ok: false, error: "Rôle inconnu." };
  const repo = getRepo();
  const target = await repo.getProfile(profileId);
  if (!target) return { ok: false, error: "Fiche introuvable." };
  if (grant === target.roles.includes(role)) return { ok: true, message: "Déjà à jour.", roles: target.roles };
  if (!grant && role === "admin" && target.id === me.profile.id) return { ok: false, error: "Tu ne peux pas retirer ton propre accès administratrice." };
  if (!grant && role === "admin" && (await repo.listProfiles()).filter((p) => p.roles.includes("admin")).length <= 1) {
    return { ok: false, error: "Il faut garder au moins une administratrice." };
  }
  try {
    const updated = grant ? await repo.grantRole(profileId, role, me.profile.id) : await repo.revokeRole(profileId, role, me.profile.id);
    const name = fullName(updated);
    const summary = grant ? `Rôle ${ROLE_LABEL[role]} donné à ${name}` : `Rôle ${ROLE_LABEL[role]} retiré à ${name}`;
    await audit({
      actorId: me.profile.id,
      action: grant ? "role.grant" : "role.revoke",
      targetType: "profile",
      targetId: updated.id,
      summary,
      details: { role, before: target.roles, after: updated.roles },
    });
    if (grant) await roleGranted(updated.id, role);
    else await roleRevoked(updated.id, role); // --- Lot 6 ---
    revalidatePath("/", "layout");
    return { ok: true, message: summary, roles: updated.roles };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Modification impossible." };
  }
}
