"use client";

import { useState, useTransition } from "react";
import { changeRoleAction } from "@/app/actions/roles";
import { GRANTABLE_ROLES, ROLE_LABEL } from "@/lib/permissions";
import type { GrantableRole } from "@/lib/types";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

/** Rôles d'une personne : retirer (×) ou ajouter un rôle. Chaque changement est journalisé côté serveur. */
export function RoleEditor({ profileId, name, initial, self }: { profileId: string; name: string; initial: GrantableRole[]; self: boolean }) {
  const [roles, setRoles] = useState(initial);
  const [pick, setPick] = useState<GrantableRole | "">("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const missing = GRANTABLE_ROLES.filter((r) => !roles.includes(r));

  const change = (role: GrantableRole, grant: boolean) =>
    start(async () => {
      const r = await changeRoleAction(profileId, role, grant);
      if (!r.ok) {
        toast(r.error, "bell");
        return;
      }
      setRoles(r.roles);
      setPick("");
      toast(r.message, grant ? "check" : "x");
    });

  return (
    <>
      <span className="role-chips" aria-busy={pending}>
        {roles.length === 0 && <span className="role-chip guest">{ROLE_LABEL.guest}</span>}
        {roles.map((r) => (
          <span key={r} className={"role-chip" + (r === "admin" ? " admin" : "")}>
            {ROLE_LABEL[r]}
            <button
              type="button"
              aria-label={`Retirer le rôle ${ROLE_LABEL[r]} à ${name}`}
              disabled={pending || (self && r === "admin")}
              title={self && r === "admin" ? "Tu ne peux pas retirer ton propre accès" : undefined}
              onClick={() => change(r, false)}
            >
              <Icon name="x" />
            </button>
          </span>
        ))}
      </span>
      <form
        className="add-role"
        onSubmit={(e) => {
          e.preventDefault();
          if (pick) change(pick, true);
        }}
      >
        <select aria-label={`Rôle à ajouter à ${name}`} value={pick} onChange={(e) => setPick(e.target.value as GrantableRole | "")} disabled={!missing.length || pending}>
          <option value="">{missing.length ? "Ajouter un rôle…" : "Tous les rôles"}</option>
          {missing.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ink btn-sm" disabled={!pick || pending} aria-busy={pending}>
          <Icon name="plus" />
          Ajouter
        </button>
      </form>
    </>
  );
}
