import { ROLE_LABEL } from "@/lib/permissions";
import type { GrantableRole } from "@/lib/types";

/** Rôles d'une personne, en pastilles (lecture seule). */
export function RoleChips({ roles }: { roles: GrantableRole[] }) {
  if (!roles.length) return <span className="role-chip guest">{ROLE_LABEL.guest}</span>;
  return (
    <span className="role-chips">
      {roles.map((r) => (
        <span key={r} className={"role-chip static" + (r === "admin" ? " admin" : "")}>
          {ROLE_LABEL[r]}
        </span>
      ))}
    </span>
  );
}
